-- Live (published) forms are read-only.
--
-- Editing questions while a form is collecting responses mixes answers to
-- different versions of the survey. The editor already renders published forms
-- read-only; this makes save_form_editor refuse them too, so a stale tab or a
-- direct RPC call can't slip an edit through. Close or unpublish to edit.
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
  -- Ownership gate (mirrors get_form_analytics). All DML below is additionally
  -- scoped to p_form_id, so foreign question ids in the payload can't touch
  -- other forms' rows.
  IF NOT EXISTS (
    SELECT 1 FROM public.forms f WHERE f.id = p_form_id AND f.user_id = auth.uid()
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

  -- 1. Form fields (trim/normalize here so client and server agree).
  UPDATE public.forms
  SET title = COALESCE(NULLIF(btrim(p_form->>'title'), ''), 'Untitled form'),
      description = NULLIF(btrim(COALESCE(p_form->>'description', '')), ''),
      display_mode = COALESCE(p_form->>'display_mode', display_mode),
      thank_you_message = LEFT(NULLIF(btrim(COALESCE(p_form->>'thank_you_message', '')), ''), 500)
  WHERE id = p_form_id;

  -- 2. Existing question ids the payload keeps.
  SELECT COALESCE(array_agg((elem->>'id')::uuid), '{}')
  INTO keep_ids
  FROM jsonb_array_elements(p_questions) elem
  WHERE elem->>'id' IS NOT NULL;

  -- 3. Delete questions of this form that are no longer present.
  DELETE FROM public.questions q
  WHERE q.form_id = p_form_id
    AND NOT (q.id = ANY(keep_ids));

  -- 4. Update existing questions (matched by id + form).
  UPDATE public.questions q
  SET type = i.type,
      label = i.label,
      options = i.options,
      required = i.required,
      logic = i.logic,
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
           (ord - 1)::int AS position
    FROM jsonb_array_elements(p_questions) WITH ORDINALITY AS t(elem, ord)
    WHERE elem->>'id' IS NOT NULL
  ) i
  WHERE q.id = i.id AND q.form_id = p_form_id;

  -- 5. Insert new questions (no id); position keeps the interleaved order.
  INSERT INTO public.questions (form_id, type, label, options, position, required, logic)
  SELECT p_form_id,
         elem->>'type',
         COALESCE(NULLIF(btrim(elem->>'label'), ''), 'Untitled question'),
         CASE WHEN jsonb_typeof(elem->'options') IN ('object', 'array')
              THEN elem->'options' ELSE NULL END,
         (ord - 1)::int,
         COALESCE((elem->>'required')::boolean, true),
         CASE WHEN jsonb_typeof(elem->'logic') = 'object'
              THEN elem->'logic' ELSE NULL END
  FROM jsonb_array_elements(p_questions) WITH ORDINALITY AS t(elem, ord)
  WHERE elem->>'id' IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.save_form_editor(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_form_editor(uuid, jsonb, jsonb) TO authenticated;
