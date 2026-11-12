-- Partial responses + cover image uploads.
--
-- 1. response_sessions: one row per respondent session, saved as they answer
--    (before submit). Drop-off is then measured from real sessions — "where
--    did unfinished respondents stop" — instead of being estimated from
--    deduped view / start / reach events.
-- 2. form-covers storage bucket: editors upload a cover image instead of
--    pasting a URL.

-- ---------------------------------------------------------------------------
-- 1. response_sessions
-- ---------------------------------------------------------------------------

CREATE TABLE public.response_sessions (
  -- Random id minted by the respondent's browser and kept in its draft, so a
  -- reload continues the same session. Unguessable; it is the only handle.
  id uuid PRIMARY KEY,
  form_id uuid NOT NULL REFERENCES public.forms (id) ON DELETE CASCADE,
  form_version integer NOT NULL DEFAULT 1,
  -- In-progress answers (question id → value). Cleared once the session
  -- submits: the response row holds them from then on.
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- The question the respondent was on when they last saved.
  current_question_id uuid,
  -- Every question the respondent has been shown (jump-aware).
  reached uuid[] NOT NULL DEFAULT '{}',
  ip_hash text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  response_id uuid REFERENCES public.responses (id) ON DELETE SET NULL,
  CONSTRAINT response_sessions_answers_object CHECK (jsonb_typeof(answers) = 'object')
);

CREATE INDEX response_sessions_form_started_idx
  ON public.response_sessions (form_id, started_at DESC);
CREATE INDEX response_sessions_form_ip_idx
  ON public.response_sessions (form_id, ip_hash, started_at);

ALTER TABLE public.response_sessions ENABLE ROW LEVEL SECURITY;

-- Read: any workspace member, like responses. No write policies — anon and
-- authenticated clients only write through save_response_progress().
CREATE POLICY "Workspace members can view response sessions" ON public.response_sessions
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = response_sessions.form_id AND private.has_role(f.user_id, 'viewer')));

REVOKE INSERT, UPDATE, DELETE ON public.response_sessions FROM anon, authenticated;

-- Link a submitted response to its session.
ALTER TABLE public.responses ADD COLUMN IF NOT EXISTS session_id uuid;

CREATE OR REPLACE FUNCTION public.save_response_progress(
  p_session_id uuid,
  p_form_id uuid,
  p_answers jsonb,
  p_current_question_id uuid DEFAULT NULL,
  p_reached uuid[] DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_version integer;
  v_owner uuid;
  v_qids uuid[];
  v_answers jsonb;
  v_reached uuid[];
  client_ip text;
  ip_key text;
  max_new_per_hour constant integer := 30;
BEGIN
  IF p_session_id IS NULL OR p_form_id IS NULL THEN
    RETURN;
  END IF;

  SELECT f.version, f.user_id INTO v_version, v_owner
  FROM public.forms f WHERE f.id = p_form_id AND f.status = 'published';
  IF NOT FOUND THEN
    RETURN;
  END IF;
  -- Owners testing their own form are never recorded (same rule as events).
  IF auth.uid() IS NOT NULL AND auth.uid() = v_owner THEN
    RETURN;
  END IF;

  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'object'
     OR octet_length(p_answers::text) > 100000 THEN
    RETURN;
  END IF;

  SELECT array_agg(q.id) INTO v_qids FROM public.questions q WHERE q.form_id = p_form_id;
  v_qids := COALESCE(v_qids, '{}');

  -- Keep only answers to this form's questions.
  SELECT COALESCE(jsonb_object_agg(e.key, e.value), '{}'::jsonb) INTO v_answers
  FROM jsonb_each(p_answers) e
  WHERE e.key ~ '^[0-9a-f-]{36}$' AND e.key::uuid = ANY (v_qids);

  SELECT COALESCE(array_agg(DISTINCT r), '{}') INTO v_reached
  FROM unnest(COALESCE(p_reached, '{}') || p_current_question_id) r
  WHERE r IS NOT NULL AND r = ANY (v_qids);

  IF p_current_question_id IS NOT NULL AND NOT (p_current_question_id = ANY (v_qids)) THEN
    p_current_question_id := NULL;
  END IF;

  -- Existing, unfinished session of this form: update it.
  UPDATE public.response_sessions s
  SET answers = v_answers,
      current_question_id = COALESCE(p_current_question_id, s.current_question_id),
      reached = ARRAY(SELECT DISTINCT x FROM unnest(s.reached || v_reached) x),
      updated_at = now()
  WHERE s.id = p_session_id AND s.form_id = p_form_id AND s.completed_at IS NULL;
  IF FOUND THEN
    RETURN;
  END IF;
  -- Id taken (other form, or already submitted): ignore.
  IF EXISTS (SELECT 1 FROM public.response_sessions s WHERE s.id = p_session_id) THEN
    RETURN;
  END IF;

  client_ip := COALESCE(
    NULLIF(current_setting('request.headers', true)::json->>'cf-connecting-ip', ''),
    NULLIF(split_part(COALESCE(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1), ''),
    'unknown'
  );
  ip_key := encode(digest(client_ip, 'sha256'), 'hex');

  -- Cap new sessions per network per form, so the table can't be flooded.
  IF (SELECT count(*) FROM public.response_sessions s
      WHERE s.form_id = p_form_id AND s.ip_hash = ip_key
        AND s.started_at > now() - interval '1 hour') >= max_new_per_hour THEN
    RETURN;
  END IF;

  INSERT INTO public.response_sessions
    (id, form_id, form_version, answers, current_question_id, reached, ip_hash)
  VALUES
    (p_session_id, p_form_id, v_version, v_answers, p_current_question_id, v_reached, ip_key)
  ON CONFLICT (id) DO NOTHING;

  -- Unfinished sessions are kept 90 days; GC on ~1% of new sessions.
  IF random() < 0.01 THEN
    DELETE FROM public.response_sessions
    WHERE completed_at IS NULL AND updated_at < now() - interval '90 days';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.save_response_progress(uuid, uuid, jsonb, uuid, uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.save_response_progress(uuid, uuid, jsonb, uuid, uuid[])
  TO anon, authenticated;

-- Submitting closes the session in the same transaction as the response.
CREATE OR REPLACE FUNCTION private.complete_response_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.session_id IS NOT NULL THEN
    UPDATE public.response_sessions s
    SET completed_at = now(),
        response_id = NEW.id,
        answers = '{}'::jsonb,
        updated_at = now()
    WHERE s.id = NEW.session_id AND s.form_id = NEW.form_id AND s.completed_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER responses_complete_session
  AFTER INSERT ON public.responses
  FOR EACH ROW EXECUTE FUNCTION private.complete_response_session();

-- Drop-off from real sessions. reached = sessions that were shown the
-- question; stopped = unfinished sessions whose last question it was.
CREATE OR REPLACE FUNCTION public.get_form_dropoff(
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
  since timestamptz := now() - make_interval(days => LEAST(GREATEST(COALESCE(p_days, 30), 1), 365));
  result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.forms f WHERE f.id = p_form_id AND private.has_role(f.user_id, 'viewer')
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  WITH s AS (
    SELECT * FROM public.response_sessions
    WHERE form_id = p_form_id AND started_at >= since
      AND (p_version IS NULL OR form_version = p_version)
  )
  SELECT jsonb_build_object(
    'started', (SELECT count(*) FROM s),
    'completed', (SELECT count(*) FROM s WHERE completed_at IS NOT NULL),
    'abandoned', (SELECT count(*) FROM s WHERE completed_at IS NULL),
    'by_question', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'question_id', q.id,
        'reached', (SELECT count(*) FROM s WHERE q.id = ANY (s.reached)),
        'stopped', (SELECT count(*) FROM s WHERE s.completed_at IS NULL AND s.current_question_id = q.id)
      ) ORDER BY q.position)
      FROM public.questions q WHERE q.form_id = p_form_id
    ), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_form_dropoff(uuid, integer, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_form_dropoff(uuid, integer, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Cover image uploads
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('form-covers', 'form-covers', true, 5242880,
        ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Objects live at "<form id>/<file>"; editors of that form's workspace manage them.
CREATE OR REPLACE FUNCTION private.can_edit_cover(p_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_form uuid;
BEGIN
  BEGIN
    v_form := split_part(p_name, '/', 1)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN false;
  END;
  RETURN EXISTS (
    SELECT 1 FROM public.forms f WHERE f.id = v_form AND private.has_role(f.user_id, 'editor'));
END;
$$;

REVOKE ALL ON FUNCTION private.can_edit_cover(text) FROM public;
GRANT EXECUTE ON FUNCTION private.can_edit_cover(text) TO authenticated;

CREATE POLICY "Editors upload form covers" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'form-covers' AND private.can_edit_cover(name));
CREATE POLICY "Editors update form covers" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'form-covers' AND private.can_edit_cover(name))
  WITH CHECK (bucket_id = 'form-covers' AND private.can_edit_cover(name));
CREATE POLICY "Editors delete form covers" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'form-covers' AND private.can_edit_cover(name));
-- Public bucket: reads go through the public URL. A SELECT policy scoped to
-- editors is added in 20261113130000 (needed for deletes).
