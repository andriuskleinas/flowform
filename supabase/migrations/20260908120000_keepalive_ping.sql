-- Keep-alive heartbeat for the free-tier Supabase auto-pause workaround.
--
-- Supabase pauses free projects after ~7 days without real database
-- activity, and a plain anon SELECT wasn't enough to reset that timer in
-- practice. This adds a real write path instead: a single-row table
-- touched via RPC by the scheduled GitHub Action.
CREATE TABLE public.keepalive_ping (
  id smallint PRIMARY KEY DEFAULT 1,
  pinged_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT keepalive_ping_single_row CHECK (id = 1)
);

INSERT INTO public.keepalive_ping (id) VALUES (1);

-- No direct client access: RLS enabled with no policies. Writes go through
-- record_keepalive_ping().
ALTER TABLE public.keepalive_ping ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.record_keepalive_ping()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.keepalive_ping SET pinged_at = now() WHERE id = 1;
$$;

GRANT EXECUTE ON FUNCTION public.record_keepalive_ping() TO anon;
