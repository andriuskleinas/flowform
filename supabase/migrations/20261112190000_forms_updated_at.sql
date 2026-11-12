-- "Recently updated" ordering for the dashboard.
--
-- forms.updated_at moves when a form's content is saved, when it is published
-- (or reopened), and when a new version is started. Organisational changes
-- such as the category or closing a form deliberately don't count.

ALTER TABLE public.forms ADD COLUMN updated_at timestamptz;
UPDATE public.forms SET updated_at = created_at;
ALTER TABLE public.forms
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

CREATE OR REPLACE FUNCTION private.forms_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published')
     OR NEW.version IS DISTINCT FROM OLD.version THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER forms_touch_updated_at
  BEFORE UPDATE OF status, version ON public.forms
  FOR EACH ROW EXECUTE FUNCTION private.forms_touch_updated_at();

-- Every editor save counts as an edit, including question-only changes.
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
      thank_you_message = LEFT(NULLIF(btrim(COALESCE(p_form->>'thank_you_message', '')), ''), 500),
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

DROP FUNCTION IF EXISTS public.get_dashboard_forms(uuid);

CREATE FUNCTION public.get_dashboard_forms(p_owner uuid DEFAULT NULL::uuid)
RETURNS TABLE(id uuid, title text, description text, created_at timestamptz,
              updated_at timestamptz, status text, category_id uuid, category text,
              category_color text, response_count bigint, question_count bigint,
              last_response_at timestamptz, responses_7d bigint, responses_90d bigint,
              views_90d bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id, f.title, f.description, f.created_at, f.updated_at, f.status, f.category_id,
    c.name, c.color, rs.total,
    (SELECT COUNT(*) FROM public.questions q WHERE q.form_id = f.id),
    rs.last_at, rs.d7, rs.d90, ev.views
  FROM public.forms f
  LEFT JOIN public.form_categories c ON c.id = f.category_id
  CROSS JOIN LATERAL (
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE r.submitted_at > now() - interval '7 days') AS d7,
           COUNT(*) FILTER (WHERE r.submitted_at > now() - interval '90 days') AS d90,
           MAX(r.submitted_at) AS last_at
    FROM public.responses r
    WHERE r.form_id = f.id
  ) rs
  CROSS JOIN LATERAL (
    SELECT COUNT(*) AS views
    FROM public.form_events e
    WHERE e.form_id = f.id AND e.kind = 'view' AND e.occurred_at > now() - interval '90 days'
  ) ev
  WHERE f.user_id = COALESCE(p_owner, auth.uid())
    AND private.has_role(COALESCE(p_owner, auth.uid()), 'viewer')
  ORDER BY f.updated_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_forms(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_forms(uuid) TO authenticated;
