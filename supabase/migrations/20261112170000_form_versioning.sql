-- Form versioning.
--
-- Responses must always match the questions they answered. Until now the only
-- guard was "live forms are read-only", but closing a form, editing it and
-- reopening it silently mixed answers to two different surveys.
--
-- Model: a form keeps ONE row (so its share link never changes) plus a
-- `version` counter. Every response and funnel event is stamped server-side
-- with the version that was live when it arrived. Once the current version has
-- responses it is frozen; "Start a new version" snapshots it into
-- form_versions, bumps the counter and unlocks the editor. Question ids carry
-- over between versions, so answers keyed by id stay comparable, and the
-- snapshot keeps labels/options for questions the new version drops.

-- 1. Version counters -------------------------------------------------------

ALTER TABLE public.forms
  ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version >= 1);

ALTER TABLE public.responses
  ADD COLUMN form_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.form_events
  ADD COLUMN form_version integer NOT NULL DEFAULT 1;

CREATE INDEX responses_form_version_idx ON public.responses (form_id, form_version);

-- 2. Stamp inserts with the live version (never trust the client) -----------

CREATE OR REPLACE FUNCTION private.stamp_form_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  SELECT f.version INTO NEW.form_version
  FROM public.forms f
  WHERE f.id = NEW.form_id;
  NEW.form_version := COALESCE(NEW.form_version, 1);
  RETURN NEW;
END;
$$;

CREATE TRIGGER responses_stamp_form_version
  BEFORE INSERT ON public.responses
  FOR EACH ROW EXECUTE FUNCTION private.stamp_form_version();

CREATE TRIGGER form_events_stamp_form_version
  BEFORE INSERT ON public.form_events
  FOR EACH ROW EXECUTE FUNCTION private.stamp_form_version();

-- 3. The version counter only moves through start_new_form_version ----------

CREATE OR REPLACE FUNCTION private.forms_version_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.version IS DISTINCT FROM OLD.version
     AND COALESCE(current_setting('flowform.bumping_version', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Form versions can only change via start_new_form_version'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER forms_version_guard
  BEFORE UPDATE OF version ON public.forms
  FOR EACH ROW EXECUTE FUNCTION private.forms_version_guard();

-- 4. Snapshots of retired versions -----------------------------------------

CREATE TABLE public.form_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version >= 1),
  title text NOT NULL,
  description text,
  display_mode text NOT NULL,
  thank_you_message text,
  questions jsonb NOT NULL CHECK (jsonb_typeof(questions) = 'array'),
  retired_at timestamptz NOT NULL DEFAULT now(),
  retired_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (form_id, version)
);

ALTER TABLE public.form_versions ENABLE ROW LEVEL SECURITY;

-- Read-only to workspace members; writes only happen inside the RPC below.
CREATE POLICY "Workspace members can view form versions"
  ON public.form_versions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = form_versions.form_id AND private.has_role(f.user_id, 'viewer')
  ));

-- 5. Start a new version ----------------------------------------------------

CREATE OR REPLACE FUNCTION public.start_new_form_version(p_form_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f public.forms%ROWTYPE;
BEGIN
  SELECT * INTO f FROM public.forms WHERE id = p_form_id FOR UPDATE;

  IF NOT FOUND OR NOT private.has_role(f.user_id, 'editor') THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.responses r
    WHERE r.form_id = p_form_id AND r.form_version = f.version
  ) THEN
    RAISE EXCEPTION 'Version % has no responses yet, so it can still be edited directly.', f.version
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.form_versions
    (form_id, version, title, description, display_mode, thank_you_message, questions, retired_by)
  SELECT f.id, f.version, f.title, f.description, f.display_mode, f.thank_you_message,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
                    'id', q.id, 'type', q.type, 'label', q.label, 'options', q.options,
                    'required', q.required, 'logic', q.logic,
                    'ai_follow_up', q.ai_follow_up, 'position', q.position)
                  ORDER BY q.position)
           FROM public.questions q WHERE q.form_id = f.id
         ), '[]'::jsonb),
         auth.uid();

  PERFORM set_config('flowform.bumping_version', 'on', true);

  -- A live form stops collecting while the new version is drafted: the link
  -- shows the closed notice until the owner publishes the new version.
  UPDATE public.forms
  SET version = f.version + 1,
      status = CASE WHEN status = 'published' THEN 'closed' ELSE status END
  WHERE id = p_form_id;

  PERFORM set_config('flowform.bumping_version', 'off', true);

  RETURN f.version + 1;
END;
$$;

REVOKE ALL ON FUNCTION public.start_new_form_version(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.start_new_form_version(uuid) TO authenticated;

-- 6. Freeze versions that already have responses ----------------------------

CREATE OR REPLACE FUNCTION public.save_form_editor(
  p_form_id uuid,
  p_form jsonb,
  p_questions jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  keep_ids uuid[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.forms f WHERE f.id = p_form_id AND private.has_role(f.user_id, 'editor')
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  -- Live forms are locked; status changes go through a plain UPDATE, not here.
  IF EXISTS (
    SELECT 1 FROM public.forms f WHERE f.id = p_form_id AND f.status = 'published'
  ) THEN
    RAISE EXCEPTION 'This form is live. Close or unpublish it before editing.'
      USING ERRCODE = '55000';
  END IF;

  -- A version that has collected answers is frozen; edits go into a new one.
  IF EXISTS (
    SELECT 1 FROM public.forms f
    JOIN public.responses r ON r.form_id = f.id AND r.form_version = f.version
    WHERE f.id = p_form_id
  ) THEN
    RAISE EXCEPTION 'This version already has responses. Start a new version to make changes.'
      USING ERRCODE = '55000';
  END IF;

  UPDATE public.forms
  SET title = COALESCE(NULLIF(btrim(p_form->>'title'), ''), 'Untitled form'),
      description = NULLIF(btrim(COALESCE(p_form->>'description', '')), ''),
      display_mode = COALESCE(p_form->>'display_mode', display_mode),
      thank_you_message = LEFT(NULLIF(btrim(COALESCE(p_form->>'thank_you_message', '')), ''), 500)
  WHERE id = p_form_id;

  SELECT COALESCE(array_agg((elem->>'id')::uuid), '{}')
  INTO keep_ids
  FROM jsonb_array_elements(p_questions) elem
  WHERE elem->>'id' IS NOT NULL;

  DELETE FROM public.questions q
  WHERE q.form_id = p_form_id
    AND NOT (q.id = ANY(keep_ids));

  UPDATE public.questions q
  SET type = i.type,
      label = i.label,
      options = i.options,
      required = i.required,
      logic = i.logic,
      ai_follow_up = i.ai_follow_up,
      position = i.position
  FROM (
    SELECT (elem->>'id')::uuid AS id,
           elem->>'type' AS type,
           COALESCE(NULLIF(btrim(elem->>'label'), ''), 'Untitled question') AS label,
           CASE WHEN jsonb_typeof(elem->'options') IN ('object', 'array')
                THEN elem->'options' ELSE NULL END AS options,
           COALESCE((elem->>'required')::boolean, true) AS required,
           CASE WHEN jsonb_typeof(elem->'logic') = 'object'
                THEN elem->'logic' ELSE NULL END AS logic,
           COALESCE((elem->>'ai_follow_up')::boolean, false)
             AND elem->>'type' IN ('text', 'long_text') AS ai_follow_up,
           (ord - 1)::int AS position
    FROM jsonb_array_elements(p_questions) WITH ORDINALITY AS t(elem, ord)
    WHERE elem->>'id' IS NOT NULL
  ) i
  WHERE q.id = i.id AND q.form_id = p_form_id;

  INSERT INTO public.questions (form_id, type, label, options, position, required, logic, ai_follow_up)
  SELECT p_form_id,
         elem->>'type',
         COALESCE(NULLIF(btrim(elem->>'label'), ''), 'Untitled question'),
         CASE WHEN jsonb_typeof(elem->'options') IN ('object', 'array')
              THEN elem->'options' ELSE NULL END,
         (ord - 1)::int,
         COALESCE((elem->>'required')::boolean, true),
         CASE WHEN jsonb_typeof(elem->'logic') = 'object'
              THEN elem->'logic' ELSE NULL END,
         COALESCE((elem->>'ai_follow_up')::boolean, false)
           AND elem->>'type' IN ('text', 'long_text')
  FROM jsonb_array_elements(p_questions) WITH ORDINALITY AS t(elem, ord)
  WHERE elem->>'id' IS NULL;
END;
$$;

-- 7. Analytics, optionally scoped to one version -----------------------------

DROP FUNCTION IF EXISTS public.get_form_analytics(uuid, integer);

CREATE OR REPLACE FUNCTION public.get_form_analytics(
  p_form_id uuid,
  p_days integer DEFAULT 30,
  p_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  days int := LEAST(GREATEST(COALESCE(p_days, 30), 1), 365);
  win timestamptz := now() - make_interval(days => LEAST(GREATEST(COALESCE(p_days, 30), 1), 365));
  result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.forms f WHERE f.id = p_form_id AND private.has_role(f.user_id, 'viewer')
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  WITH
  r AS (
    SELECT * FROM public.responses
    WHERE form_id = p_form_id AND (p_version IS NULL OR form_version = p_version)
  ),
  ev AS (
    SELECT * FROM public.form_events
    WHERE form_id = p_form_id AND (p_version IS NULL OR form_version = p_version)
  ),
  -- Question types across every version, so answers to questions a later
  -- version removed still aggregate.
  qtypes AS (
    SELECT q.id::text AS qid, q.type FROM public.questions q WHERE q.form_id = p_form_id
    UNION
    SELECT e->>'id', e->>'type'
    FROM public.form_versions v, jsonb_array_elements(v.questions) e
    WHERE v.form_id = p_form_id
  )
  SELECT jsonb_build_object(
    'totals', (
      SELECT jsonb_build_object(
        'responses', COUNT(*),
        'last7', COUNT(*) FILTER (WHERE submitted_at > now() - interval '7 days'),
        'avg_fill_seconds', AVG(EXTRACT(EPOCH FROM (submitted_at - started_at))) FILTER (
          WHERE started_at IS NOT NULL
            AND submitted_at > started_at
            AND submitted_at - started_at < interval '2 hours'
        ),
        'timed_count', COUNT(*) FILTER (
          WHERE started_at IS NOT NULL
            AND submitted_at > started_at
            AND submitted_at - started_at < interval '2 hours'
        )
      )
      FROM r
    ),
    'funnel', jsonb_build_object(
      'views', (SELECT COUNT(*) FROM ev WHERE kind = 'view' AND occurred_at > win),
      'starts', (SELECT COUNT(*) FROM ev WHERE kind = 'start' AND occurred_at > win),
      'submits', (SELECT COUNT(*) FROM r WHERE submitted_at > win)
    ),
    'trend', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object('day', to_char(d.day, 'YYYY-MM-DD'), 'count', COALESCE(c.cnt, 0))
          ORDER BY d.day
        ),
        '[]'::jsonb
      )
      FROM generate_series(
        date_trunc('day', now()) - make_interval(days => days - 1),
        date_trunc('day', now()),
        interval '1 day'
      ) AS d(day)
      LEFT JOIN (
        SELECT date_trunc('day', submitted_at) AS day, COUNT(*) AS cnt
        FROM r
        WHERE submitted_at > date_trunc('day', now()) - make_interval(days => days - 1)
        GROUP BY 1
      ) c ON c.day = d.day
    ),
    'reach', (
      SELECT COALESCE(
        jsonb_agg(jsonb_build_object('question_id', t.question_id, 'count', t.cnt)),
        '[]'::jsonb
      )
      FROM (
        SELECT question_id, COUNT(*) AS cnt
        FROM ev
        WHERE kind = 'reach' AND question_id IS NOT NULL
        GROUP BY question_id
      ) t
    ),
    'value_counts', (
      SELECT COALESCE(
        jsonb_agg(jsonb_build_object('question_id', t.qid, 'value', t.val, 'count', t.cnt)),
        '[]'::jsonb
      )
      FROM (
        SELECT
          a.key AS qid,
          CASE WHEN jsonb_typeof(a.value) = 'array' THEN e.val ELSE a.value #>> '{}' END AS val,
          COUNT(*) AS cnt
        FROM r
        CROSS JOIN LATERAL jsonb_each(r.answers) AS a(key, value)
        LEFT JOIN LATERAL jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(a.value) = 'array' THEN a.value ELSE '[]'::jsonb END
        ) AS e(val) ON true
        WHERE a.key IN (
            SELECT qt.qid FROM qtypes qt WHERE qt.type NOT IN ('text', 'long_text')
          )
          AND (jsonb_typeof(a.value) <> 'array' OR e.val IS NOT NULL)
        GROUP BY 1, 2
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_form_analytics(uuid, integer, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_form_analytics(uuid, integer, integer) TO authenticated;

-- 8. Per-version comparison -------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_form_versions(p_form_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f public.forms%ROWTYPE;
  result jsonb;
BEGIN
  SELECT * INTO f FROM public.forms WHERE id = p_form_id;
  IF NOT FOUND OR NOT private.has_role(f.user_id, 'viewer') THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  WITH
  versions AS (
    SELECT v.version, v.title, v.questions, v.retired_at AS ended_at, false AS is_current
    FROM public.form_versions v
    WHERE v.form_id = p_form_id
    UNION ALL
    SELECT f.version, f.title,
           COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
                      'id', q.id, 'type', q.type, 'label', q.label, 'options', q.options,
                      'required', q.required, 'logic', q.logic,
                      'ai_follow_up', q.ai_follow_up, 'position', q.position)
                    ORDER BY q.position)
             FROM public.questions q WHERE q.form_id = p_form_id
           ), '[]'::jsonb),
           NULL::timestamptz,
           true
  ),
  dated AS (
    SELECT vs.*,
           COALESCE(LAG(vs.ended_at) OVER (ORDER BY vs.version), f.created_at) AS started_at
    FROM versions vs
  ),
  resp AS (
    SELECT form_version,
           COUNT(*) AS responses,
           MAX(submitted_at) AS last_response_at,
           AVG(EXTRACT(EPOCH FROM (submitted_at - started_at))) FILTER (
             WHERE started_at IS NOT NULL
               AND submitted_at > started_at
               AND submitted_at - started_at < interval '2 hours'
           ) AS avg_fill_seconds
    FROM public.responses
    WHERE form_id = p_form_id
    GROUP BY form_version
  ),
  evs AS (
    SELECT form_version,
           COUNT(*) FILTER (WHERE kind = 'view') AS views,
           COUNT(*) FILTER (WHERE kind = 'start') AS starts
    FROM public.form_events
    WHERE form_id = p_form_id
    GROUP BY form_version
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'version', d.version,
           'is_current', d.is_current,
           'title', d.title,
           'questions', d.questions,
           'started_at', d.started_at,
           'ended_at', d.ended_at,
           'responses', COALESCE(r.responses, 0),
           'last_response_at', r.last_response_at,
           'avg_fill_seconds', r.avg_fill_seconds,
           'views', COALESCE(e.views, 0),
           'starts', COALESCE(e.starts, 0)
         ) ORDER BY d.version DESC), '[]'::jsonb)
  INTO result
  FROM dated d
  LEFT JOIN resp r ON r.form_version = d.version
  LEFT JOIN evs e ON e.form_version = d.version;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_form_versions(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_form_versions(uuid) TO authenticated;
