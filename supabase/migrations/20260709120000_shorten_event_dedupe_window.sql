-- Shorten the funnel-event dedupe window from 30 minutes to 15 seconds.
--
-- The client already fires each event exactly once per page load, so the
-- server-side window only needs to swallow near-instant duplicate fires
-- (SSR/StrictMode re-fire, an accidental double-open). A 30-minute window also
-- collapsed every distinct visit from one IP into a single view, which meant
-- the form owner testing their own form (now tracked, no longer skipped
-- client-side) saw only one view no matter how many times they opened it.
-- 15 seconds keeps the double-fire guard while letting genuinely separate
-- visits — including repeated testing — each count.
CREATE OR REPLACE FUNCTION public.record_form_event(
  p_form_id uuid,
  p_kind text,
  p_question_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  client_ip text;
  ip_key text;
  dedupe_window constant interval := interval '15 seconds';
BEGIN
  IF p_kind NOT IN ('view', 'start', 'reach') THEN
    RETURN;
  END IF;
  -- Only published forms accumulate events.
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

  -- Dedupe: one event per (form, ip, kind, question) per window.
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

  INSERT INTO public.form_events (form_id, question_id, kind, ip_hash)
  VALUES (p_form_id, p_question_id, p_kind, ip_key);
END;
$$;
