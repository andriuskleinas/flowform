-- Garbage-collect old form_events so the analytics table stays bounded.
--
-- Unlike response_submission_log (short-lived rate-limit rows, 1% opportunistic
-- cleanup), form_events IS the analytics data and is read over windows up to
-- 365 days (get_form_analytics clamps p_days to 365; the UI offers ≤90d). So we
-- keep a generous 400-day retention — longer than anything queryable — and GC
-- opportunistically on insert, no cron needed.
--
-- A BRIN index on occurred_at makes the time-range delete cheap at scale
-- (form_events is append-ordered by time; BRIN is tiny). The existing
-- (form_id, kind, occurred_at) / (form_id, ip_hash, kind, occurred_at) indexes
-- don't help a global `occurred_at < cutoff` scan.
CREATE INDEX IF NOT EXISTS form_events_occurred_at_brin
  ON public.form_events USING brin (occurred_at);

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
  dedupe_window constant interval := interval '30 minutes';
  retention constant interval := interval '400 days';
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

  -- Opportunistic cleanup: rarely GC events past the retention window so the
  -- table stays bounded without a cron. Retention (400d) is longer than any
  -- queryable window, so windowed metrics are never affected (all-time reach
  -- loses only >400-day-old data).
  IF random() < 0.005 THEN
    DELETE FROM public.form_events WHERE occurred_at < now() - retention;
  END IF;
END;
$$;
