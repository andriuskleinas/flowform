-- Atomic editor save.
--
-- Replaces the client's N+1 save path (one UPDATE per changed/reordered
-- question + a batch insert + a trailing delete, run as separate round-trips
-- and not transactional — a mid-save failure could leave positions
-- half-updated). This RPC takes the form fields and the full ordered question
-- list as jsonb and applies delete/update/insert + repositioning in a single
-- transaction.
--
-- Contract with the client:
--   * p_questions is the full, ordered list of *visible* (non-deleted)
--     questions; array order defines `position` (0-based).
--   * Each item has an `id` (existing question's uuid) or null (new question).
--     Existing ids preserve the row — critical, since responses.answers is
--     keyed by question id.
--   * `logic` is already sanitized client-side (only references still-valid
--     later, already-saved questions), so this function stores it as-is.
--   * Questions of this form NOT present in p_questions are deleted.
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
