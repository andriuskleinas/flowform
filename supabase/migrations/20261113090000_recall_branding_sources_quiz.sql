-- Answer recall, per-form branding, hidden fields / UTM sources, quiz mode.
--
-- forms.settings (jsonb, one object so the editor diff and the RPCs stay simple):
--   theme          { accent: "#rrggbb", font: "roboto"|"serif"|"grotesk"|"mono", cover_url }
--   redirect_url   where to send respondents after they submit (http/https only)
--   hidden_fields  ["name", "plan", …] URL params captured into responses.meta.hidden
--   quiz           { enabled, show_score, outcomes: [{ id, title, message, min_score }] }
--
-- questions.recall_key  a variable name: later labels can say "Thanks, {name}!"
-- questions.points      { "<choice>": number } for quiz scoring
--
-- responses.meta        { source, medium, campaign, term, content, referrer, hidden: {…} }
-- responses.score / outcome are computed by a trigger from the live questions,
-- never taken from the client.
--
-- form_events.source    traffic source of a 'view', for per-source conversion.

-- 1. Columns ------------------------------------------------------------------

ALTER TABLE public.forms
  ADD COLUMN settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD CONSTRAINT forms_settings_shape
    CHECK (jsonb_typeof(settings) = 'object' AND pg_column_size(settings) < 16384);

ALTER TABLE public.questions
  ADD COLUMN recall_key text,
  ADD COLUMN points jsonb,
  ADD CONSTRAINT questions_recall_key_format
    CHECK (recall_key IS NULL OR recall_key ~ '^[a-z][a-z0-9_]{0,23}$'),
  ADD CONSTRAINT questions_points_shape
    CHECK (points IS NULL OR jsonb_typeof(points) = 'object');

ALTER TABLE public.responses
  ADD COLUMN meta jsonb,
  ADD COLUMN score integer,
  ADD COLUMN outcome text,
  ADD CONSTRAINT responses_meta_shape
    CHECK (meta IS NULL OR (jsonb_typeof(meta) = 'object' AND pg_column_size(meta) < 4096));

ALTER TABLE public.form_events ADD COLUMN source text;

ALTER TABLE public.form_versions ADD COLUMN settings jsonb;

-- 2. Settings sanitizer (URLs must be http/https; everything else is shaped by
--    the editor and only rendered as text) -----------------------------------

CREATE OR REPLACE FUNCTION private.clean_form_settings(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  s jsonb := CASE WHEN jsonb_typeof(p) = 'object' THEN p ELSE '{}'::jsonb END;
  theme jsonb;
BEGIN
  IF NOT (COALESCE(s->>'redirect_url', '') ~* '^https?://\S{3,}$' AND length(s->>'redirect_url') <= 500) THEN
    s := s - 'redirect_url';
  END IF;

  theme := CASE WHEN jsonb_typeof(s->'theme') = 'object' THEN s->'theme' ELSE '{}'::jsonb END;
  IF NOT (COALESCE(theme->>'accent', '') ~* '^#[0-9a-f]{6}$') THEN
    theme := theme - 'accent';
  END IF;
  IF NOT (COALESCE(theme->>'font', '') IN ('roboto', 'serif', 'grotesk', 'mono')) THEN
    theme := theme - 'font';
  END IF;
  IF NOT (COALESCE(theme->>'cover_url', '') ~* '^https://\S{3,}$' AND length(theme->>'cover_url') <= 500) THEN
    theme := theme - 'cover_url';
  END IF;
  s := CASE WHEN theme = '{}'::jsonb THEN s - 'theme' ELSE s || jsonb_build_object('theme', theme) END;

  IF jsonb_typeof(s->'hidden_fields') = 'array' THEN
    s := s || jsonb_build_object('hidden_fields', COALESCE((
      SELECT jsonb_agg(DISTINCT lower(e))
      FROM (SELECT e FROM jsonb_array_elements_text(s->'hidden_fields') e LIMIT 10) t
      WHERE lower(e) ~ '^[a-z][a-z0-9_]{0,23}$'
    ), '[]'::jsonb));
  ELSE
    s := s - 'hidden_fields';
  END IF;

  IF jsonb_typeof(s->'quiz') IS DISTINCT FROM 'object' THEN
    s := s - 'quiz';
  END IF;

  RETURN s;
END;
$$;

-- 3. Response preparation: clean meta, compute quiz score + outcome ---------

CREATE OR REPLACE FUNCTION private.prepare_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  s jsonb;
  quiz jsonb;
  m jsonb := '{}'::jsonb;
  hidden jsonb;
  k text;
  total numeric := 0;
BEGIN
  SELECT f.settings INTO s FROM public.forms f WHERE f.id = NEW.form_id;
  s := COALESCE(s, '{}'::jsonb);

  -- Only known keys, short strings. Sources are lower-cased so "Newsletter"
  -- and "newsletter" count together.
  IF jsonb_typeof(NEW.meta) = 'object' THEN
    FOREACH k IN ARRAY ARRAY['source', 'medium', 'campaign', 'term', 'content', 'referrer'] LOOP
      IF jsonb_typeof(NEW.meta->k) = 'string' AND btrim(NEW.meta->>k) <> '' THEN
        m := m || jsonb_build_object(
          k,
          CASE WHEN k IN ('source', 'medium', 'referrer')
               THEN lower(left(btrim(NEW.meta->>k), 100))
               ELSE left(btrim(NEW.meta->>k), 100) END);
      END IF;
    END LOOP;
    IF jsonb_typeof(NEW.meta->'hidden') = 'object' AND jsonb_typeof(s->'hidden_fields') = 'array' THEN
      SELECT jsonb_object_agg(h.key, left(btrim(h.value #>> '{}'), 200)) INTO hidden
      FROM jsonb_each(NEW.meta->'hidden') h
      WHERE (s->'hidden_fields') ? h.key
        AND jsonb_typeof(h.value) = 'string'
        AND btrim(h.value #>> '{}') <> '';
      IF hidden IS NOT NULL THEN m := m || jsonb_build_object('hidden', hidden); END IF;
    END IF;
  END IF;
  NEW.meta := NULLIF(m, '{}'::jsonb);

  NEW.score := NULL;
  NEW.outcome := NULL;
  quiz := s->'quiz';
  IF jsonb_typeof(quiz) = 'object' AND COALESCE(quiz->>'enabled', 'false') = 'true' THEN
    SELECT COALESCE(SUM(
      CASE
        WHEN jsonb_typeof(NEW.answers->(q.id::text)) = 'array' THEN (
          SELECT COALESCE(SUM((q.points->>e)::numeric), 0)
          FROM jsonb_array_elements_text(NEW.answers->(q.id::text)) e
          WHERE jsonb_typeof(q.points->e) = 'number')
        WHEN jsonb_typeof(q.points->(NEW.answers->>(q.id::text))) = 'number'
          THEN (q.points->>(NEW.answers->>(q.id::text)))::numeric
        ELSE 0
      END), 0)
    INTO total
    FROM public.questions q
    WHERE q.form_id = NEW.form_id
      AND q.points IS NOT NULL
      AND NEW.answers ? (q.id::text);

    NEW.score := round(total)::int;

    SELECT o->>'id' INTO NEW.outcome
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(quiz->'outcomes') = 'array' THEN quiz->'outcomes' ELSE '[]'::jsonb END
    ) o
    WHERE jsonb_typeof(o->'min_score') = 'number'
      AND (o->>'min_score')::numeric <= NEW.score
    ORDER BY (o->>'min_score')::numeric DESC
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER responses_prepare
  BEFORE INSERT ON public.responses
  FOR EACH ROW EXECUTE FUNCTION private.prepare_response();

-- 4. Funnel views remember their traffic source ------------------------------

DROP FUNCTION IF EXISTS public.record_form_event(uuid, text, uuid);

CREATE OR REPLACE FUNCTION public.record_form_event(
  p_form_id uuid,
  p_kind text,
  p_question_id uuid DEFAULT NULL,
  p_source text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  client_ip text;
  ip_key text;
  dedupe_window constant interval := interval '30 minutes';
  retention constant interval := interval '400 days';
BEGIN
  IF p_kind NOT IN ('view', 'start', 'reach') THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.forms f WHERE f.id = p_form_id AND f.status = 'published'
  ) THEN
    RETURN;
  END IF;
  IF p_question_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.questions q WHERE q.id = p_question_id AND q.form_id = p_form_id
  ) THEN
    RETURN;
  END IF;

  client_ip := COALESCE(
    NULLIF(current_setting('request.headers', true)::json->>'cf-connecting-ip', ''),
    NULLIF(
      split_part(
        COALESCE(current_setting('request.headers', true)::json->>'x-forwarded-for', ''),
        ',',
        1
      ),
      ''
    ),
    'unknown'
  );
  ip_key := encode(digest(client_ip, 'sha256'), 'hex');

  IF EXISTS (
    SELECT 1 FROM public.form_events e
    WHERE e.form_id = p_form_id
      AND e.ip_hash = ip_key
      AND e.kind = p_kind
      AND e.question_id IS NOT DISTINCT FROM p_question_id
      AND e.occurred_at > now() - dedupe_window
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.form_events (form_id, question_id, kind, ip_hash, source)
  VALUES (
    p_form_id, p_question_id, p_kind, ip_key,
    CASE WHEN p_kind = 'view' THEN NULLIF(lower(left(btrim(COALESCE(p_source, '')), 100)), '') END
  );

  IF random() < 0.005 THEN
    DELETE FROM public.form_events WHERE occurred_at < now() - retention;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_form_event(uuid, text, uuid, text) TO anon, authenticated;

-- 5. Editor save carries settings, recall keys and points --------------------

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

  IF EXISTS (
    SELECT 1 FROM public.forms f WHERE f.id = p_form_id AND f.status = 'published'
  ) THEN
    RAISE EXCEPTION 'This form is live. Close or unpublish it before editing.'
      USING ERRCODE = '55000';
  END IF;

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
      thank_you_message = LEFT(NULLIF(btrim(COALESCE(p_form->>'thank_you_message', '')), ''), 500),
      settings = CASE WHEN p_form ? 'settings'
                      THEN private.clean_form_settings(p_form->'settings')
                      ELSE settings END,
      updated_at = now()
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
      recall_key = i.recall_key,
      points = i.points,
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
           CASE WHEN lower(btrim(COALESCE(elem->>'recall_key', ''))) ~ '^[a-z][a-z0-9_]{0,23}$'
                THEN lower(btrim(elem->>'recall_key')) END AS recall_key,
           CASE WHEN jsonb_typeof(elem->'points') = 'object' AND elem->'points' <> '{}'::jsonb
                THEN elem->'points' END AS points,
           (ord - 1)::int AS position
    FROM jsonb_array_elements(p_questions) WITH ORDINALITY AS t(elem, ord)
    WHERE elem->>'id' IS NOT NULL
  ) i
  WHERE q.id = i.id AND q.form_id = p_form_id;

  INSERT INTO public.questions
    (form_id, type, label, options, position, required, logic, ai_follow_up, recall_key, points)
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
           AND elem->>'type' IN ('text', 'long_text'),
         CASE WHEN lower(btrim(COALESCE(elem->>'recall_key', ''))) ~ '^[a-z][a-z0-9_]{0,23}$'
              THEN lower(btrim(elem->>'recall_key')) END,
         CASE WHEN jsonb_typeof(elem->'points') = 'object' AND elem->'points' <> '{}'::jsonb
              THEN elem->'points' END
  FROM jsonb_array_elements(p_questions) WITH ORDINALITY AS t(elem, ord)
  WHERE elem->>'id' IS NULL;
END;
$$;

-- 6. Copies and version snapshots keep the new fields ------------------------

CREATE OR REPLACE FUNCTION public.copy_form(p_form_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f public.forms%ROWTYPE;
  new_id uuid;
  id_map jsonb := '{}'::jsonb;
  q record;
  new_qid uuid;
BEGIN
  SELECT * INTO f FROM public.forms WHERE id = p_form_id;
  IF NOT FOUND OR NOT private.has_role(f.user_id, 'editor') THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.forms
    (title, description, user_id, status, display_mode, thank_you_message, category_id,
     copied_from, settings)
  VALUES
    (LEFT(f.title, 290) || ' (copy)', f.description, f.user_id, 'draft', f.display_mode,
     f.thank_you_message, f.category_id, f.id, f.settings)
  RETURNING id INTO new_id;

  FOR q IN
    SELECT * FROM public.questions WHERE form_id = p_form_id ORDER BY position
  LOOP
    INSERT INTO public.questions
      (form_id, type, label, options, position, required, ai_follow_up, logic, recall_key, points)
    VALUES
      (new_id, q.type, q.label, q.options, q.position, q.required, q.ai_follow_up, NULL,
       q.recall_key, q.points)
    RETURNING id INTO new_qid;
    id_map := id_map || jsonb_build_object(q.id::text, new_qid::text);
  END LOOP;

  UPDATE public.questions nq
  SET logic = jsonb_build_object('jumps', remapped.jumps)
  FROM (
    SELECT (id_map ->> oq.id::text)::uuid AS new_qid,
           jsonb_object_agg(j.key,
             CASE WHEN j.value #>> '{}' = 'end' THEN 'end'
                  ELSE id_map ->> (j.value #>> '{}') END) AS jumps
    FROM public.questions oq
    CROSS JOIN LATERAL jsonb_each(oq.logic -> 'jumps') AS j(key, value)
    WHERE oq.form_id = p_form_id
      AND jsonb_typeof(oq.logic -> 'jumps') = 'object'
      AND (j.value #>> '{}' = 'end' OR id_map ? (j.value #>> '{}'))
    GROUP BY oq.id
  ) remapped
  WHERE nq.id = remapped.new_qid;

  RETURN new_id;
END;
$$;

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
    (form_id, version, title, description, display_mode, thank_you_message, questions,
     retired_by, settings)
  SELECT f.id, f.version, f.title, f.description, f.display_mode, f.thank_you_message,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
                    'id', q.id, 'type', q.type, 'label', q.label, 'options', q.options,
                    'required', q.required, 'logic', q.logic,
                    'ai_follow_up', q.ai_follow_up, 'position', q.position,
                    'recall_key', q.recall_key, 'points', q.points)
                  ORDER BY q.position)
           FROM public.questions q WHERE q.form_id = f.id
         ), '[]'::jsonb),
         auth.uid(),
         f.settings;

  PERFORM set_config('flowform.bumping_version', 'on', true);

  UPDATE public.forms
  SET version = f.version + 1,
      status = CASE WHEN status = 'published' THEN 'closed' ELSE status END
  WHERE id = p_form_id;

  PERFORM set_config('flowform.bumping_version', 'off', true);

  RETURN f.version + 1;
END;
$$;

-- 7. Insights: traffic sources, quiz results, hidden-field values -------------

CREATE OR REPLACE FUNCTION public.get_form_insights(
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
  v AS (
    SELECT COALESCE(source, 'direct') AS source, COUNT(*) AS views
    FROM public.form_events
    WHERE form_id = p_form_id AND kind = 'view' AND occurred_at > win
      AND (p_version IS NULL OR form_version = p_version)
    GROUP BY 1
  ),
  s AS (
    SELECT COALESCE(meta->>'source', meta->>'referrer', 'direct') AS source, COUNT(*) AS submits
    FROM r WHERE submitted_at > win
    GROUP BY 1
  )
  SELECT jsonb_build_object(
    'sources', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'source', COALESCE(v.source, s.source),
               'views', COALESCE(v.views, 0),
               'submits', COALESCE(s.submits, 0))
             ORDER BY COALESCE(s.submits, 0) DESC, COALESCE(v.views, 0) DESC), '[]'::jsonb)
      FROM v FULL OUTER JOIN s ON s.source = v.source
    ),
    'campaigns', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('campaign', t.c, 'submits', t.n)
             ORDER BY t.n DESC), '[]'::jsonb)
      FROM (
        SELECT meta->>'campaign' AS c, COUNT(*) AS n
        FROM r WHERE submitted_at > win AND meta ? 'campaign'
        GROUP BY 1 ORDER BY 2 DESC LIMIT 10
      ) t
    ),
    'hidden', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('field', t.k, 'value', t.val, 'count', t.n)
             ORDER BY t.k, t.n DESC), '[]'::jsonb)
      FROM (
        SELECT h.key AS k, h.value #>> '{}' AS val, COUNT(*) AS n,
               row_number() OVER (PARTITION BY h.key ORDER BY COUNT(*) DESC) AS rn
        FROM r CROSS JOIN LATERAL jsonb_each(COALESCE(r.meta->'hidden', '{}'::jsonb)) h
        WHERE r.submitted_at > win
        GROUP BY 1, 2
      ) t
      WHERE t.rn <= 8
    ),
    'quiz', (
      SELECT jsonb_build_object(
        'scored', COUNT(*),
        'avg', AVG(score),
        'min', MIN(score),
        'max', MAX(score),
        'outcomes', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object('outcome', o.outcome, 'count', o.n)), '[]'::jsonb)
          FROM (SELECT outcome, COUNT(*) AS n FROM r WHERE score IS NOT NULL GROUP BY 1) o
        ),
        'distribution', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object('score', d.score, 'count', d.n)
                 ORDER BY d.score), '[]'::jsonb)
          FROM (SELECT score, COUNT(*) AS n FROM r WHERE score IS NOT NULL GROUP BY 1) d
        )
      )
      FROM r WHERE score IS NOT NULL
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_form_insights(uuid, integer, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_form_insights(uuid, integer, integer) TO authenticated;
