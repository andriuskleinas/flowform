-- Rate-limit guardrail for response submissions, defence-in-depth.
--
-- Background: response inserts go from the browser directly to PostgREST,
-- bypassing our Cloudflare Worker. That means any rate-limit binding on
-- the Worker can't see those writes. The DB is the only chokepoint we
-- control, so we enforce here.
--
-- Two concentric rings:
--   1. Inner — per (form, client IP), tight (20 / minute). Cuts off a
--      single attacker without affecting other respondents.
--   2. Outer — per form globally, generous (1000 / minute). Catches the
--      "many IPs, one form" botnet pattern where each IP individually
--      stays under the inner threshold.
--
-- Client IP comes from PostgREST-forwarded request headers; the IP is
-- hashed before storage so the log doesn't retain raw PII.

-- pgcrypto powers digest() for the IP hash. Supabase enables it by default;
-- this is just being explicit so the migration is self-contained.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- Bookkeeping table
-- ---------------------------------------------------------------------------
CREATE TABLE public.response_submission_log (
  id bigserial PRIMARY KEY,
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  ip_hash text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

-- Composite index for the inner ring lookup.
CREATE INDEX response_submission_log_form_ip_time_idx
  ON public.response_submission_log (form_id, ip_hash, submitted_at DESC);

-- Secondary index for the outer ring (per-form-global) lookup.
CREATE INDEX response_submission_log_form_time_idx
  ON public.response_submission_log (form_id, submitted_at DESC);

-- The log is internal bookkeeping; clients have no business reading or
-- writing it directly. RLS enabled with no policies → PostgREST returns
-- empty for any authenticated query.
ALTER TABLE public.response_submission_log ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Trigger function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_response_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  client_ip  text;
  ip_key     text;
  ip_count   int;
  form_count int;

  -- Tuning knobs. Adjust here if a form legitimately needs higher throughput.
  rate_window       constant interval := interval '1 minute';
  rate_max_per_ip   constant int      := 20;
  rate_max_per_form constant int      := 1000;
BEGIN
  -- Resolve client IP from PostgREST-forwarded headers.
  -- Preference order:
  --   1. cf-connecting-ip — set by Cloudflare on the way in, hard to spoof
  --   2. first hop of x-forwarded-for
  --   3. literal 'unknown' (direct DB connections, service-role calls)
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
  -- Hash the IP so the log can rate-limit without retaining PII.
  ip_key := encode(digest(client_ip, 'sha256'), 'hex');

  -- Inner ring: per (form, IP).
  SELECT COUNT(*) INTO ip_count
  FROM public.response_submission_log
  WHERE form_id = NEW.form_id
    AND ip_hash = ip_key
    AND submitted_at > now() - rate_window;

  IF ip_count >= rate_max_per_ip THEN
    RAISE EXCEPTION 'Too many submissions for form % from this client', NEW.form_id
      USING ERRCODE = '53400';  -- configuration_limit_exceeded
  END IF;

  -- Outer ring: per-form global.
  SELECT COUNT(*) INTO form_count
  FROM public.response_submission_log
  WHERE form_id = NEW.form_id
    AND submitted_at > now() - rate_window;

  IF form_count >= rate_max_per_form THEN
    RAISE EXCEPTION 'Too many submissions for form %, try again shortly', NEW.form_id
      USING ERRCODE = '53400';
  END IF;

  INSERT INTO public.response_submission_log (form_id, ip_hash)
    VALUES (NEW.form_id, ip_key);

  -- Opportunistic cleanup: 1% of inserts garbage-collect rows older than
  -- five rate-windows. Avoids unbounded growth without needing a cron job.
  IF random() < 0.01 THEN
    DELETE FROM public.response_submission_log
    WHERE submitted_at < now() - (rate_window * 5);
  END IF;

  RETURN NEW;
END;
$$;

-- Lock down execution: the trigger runs as definer so callers don't need
-- direct EXECUTE on the function. Keep everyone else out of it.
REVOKE EXECUTE ON FUNCTION public.enforce_response_rate_limit() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Wire the trigger
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS enforce_response_rate_limit_trigger ON public.responses;
CREATE TRIGGER enforce_response_rate_limit_trigger
  BEFORE INSERT ON public.responses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_response_rate_limit();
