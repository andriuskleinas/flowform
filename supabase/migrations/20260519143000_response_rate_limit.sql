-- Rate-limit guardrail for response submissions.
--
-- Background: response inserts go from the browser directly to PostgREST,
-- bypassing our Cloudflare Worker. That means any rate-limit binding on
-- the Worker can't see those writes. The DB is the only chokepoint we
-- control, so we enforce here.
--
-- Limitation: a regular PL/pgSQL trigger does not see the client IP, so
-- this rate-limit is **per-form, globally** rather than per-IP. The
-- threshold is generous enough that a legitimate burst (a survey link
-- going viral on Slack/Twitter) shouldn't trip it, while still cutting
-- off the trivial "POST 10000 fake responses in a tight loop" attack.
-- A per-IP limit needs a Supabase Edge Function proxy — tracked as a
-- follow-up.

-- ---------------------------------------------------------------------------
-- Bookkeeping table
-- ---------------------------------------------------------------------------
CREATE TABLE public.response_submission_log (
  id bigserial PRIMARY KEY,
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX response_submission_log_form_time_idx
  ON public.response_submission_log (form_id, submitted_at DESC);

-- The log is internal bookkeeping; clients have no business reading or
-- writing it directly. RLS is enabled with no policies so PostgREST
-- returns empty for any authenticated query.
ALTER TABLE public.response_submission_log ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Trigger function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_response_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count int;
  -- Tuning knobs. Adjust here if a form legitimately needs higher throughput.
  rate_window  constant interval := interval '1 minute';
  rate_max     constant int      := 300;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.response_submission_log
  WHERE form_id = NEW.form_id
    AND submitted_at > now() - rate_window;

  IF recent_count >= rate_max THEN
    RAISE EXCEPTION 'Too many submissions for form %, try again shortly', NEW.form_id
      USING ERRCODE = '53400';  -- configuration_limit_exceeded
  END IF;

  INSERT INTO public.response_submission_log (form_id) VALUES (NEW.form_id);

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
-- direct EXECUTE on the function. Keep PUBLIC out of it.
REVOKE EXECUTE ON FUNCTION public.enforce_response_rate_limit() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Wire the trigger
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS enforce_response_rate_limit_trigger ON public.responses;
CREATE TRIGGER enforce_response_rate_limit_trigger
  BEFORE INSERT ON public.responses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_response_rate_limit();
