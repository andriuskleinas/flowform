-- "Edit a copy": duplicate a survey into a new draft in one transaction.
--
-- Replaces the dashboard's client-side duplicate (several round trips, not
-- atomic, and it dropped the thank-you message). The copy remembers where it
-- came from in copied_from, so the editor can offer to close the original
-- once the copy goes live.

ALTER TABLE public.forms
  ADD COLUMN copied_from uuid REFERENCES public.forms(id) ON DELETE SET NULL;

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

  -- The copy belongs to the same workspace as the original.
  INSERT INTO public.forms
    (title, description, user_id, status, display_mode, thank_you_message, category_id, copied_from)
  VALUES
    (LEFT(f.title, 290) || ' (copy)', f.description, f.user_id, 'draft', f.display_mode,
     f.thank_you_message, f.category_id, f.id)
  RETURNING id INTO new_id;

  FOR q IN
    SELECT * FROM public.questions WHERE form_id = p_form_id ORDER BY position
  LOOP
    INSERT INTO public.questions
      (form_id, type, label, options, position, required, ai_follow_up, logic)
    VALUES
      (new_id, q.type, q.label, q.options, q.position, q.required, q.ai_follow_up, NULL)
    RETURNING id INTO new_qid;
    id_map := id_map || jsonb_build_object(q.id::text, new_qid::text);
  END LOOP;

  -- Logic jumps point at question ids: rewrite them to the copies' ids and
  -- drop any that no longer resolve.
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

REVOKE ALL ON FUNCTION public.copy_form(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.copy_form(uuid) TO authenticated;
