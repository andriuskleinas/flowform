-- One response per respondent per form.
--
-- Respondents are anonymous, so "same respondent" is approximated by client
-- IP (same header resolution as enforce_response_rate_limit). The first
-- submission from an IP claims (form, ip_hash); any later one is rejected with
-- unique_violation (23505), which the public form page turns into its
-- "You've already responded" screen. The browser-side localStorage flag stays
-- as the fast path; this is the enforcement.
--
-- Trade-off (chosen deliberately): respondents sharing one public IP — an
-- office, school or home network — can only answer once between them.
--
-- Claims live in their own table rather than on responses, because owners can
-- read responses and an unsalted IPv4 hash is trivially reversible.
-- Inserts with no forwarded IP (direct DB / service-role) are not limited.
-- Existing responses are not backfilled: their IPs were never stored.

CREATE TABLE public.response_respondents (
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (form_id, ip_hash)
);

-- Internal bookkeeping: RLS on with no policies, so no client can read it.
ALTER TABLE public.response_respondents ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.enforce_one_response_per_respondent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  client_ip text;
BEGIN
  client_ip := COALESCE(
    NULLIF(current_setting('request.headers', true)::json->>'cf-connecting-ip', ''),
    NULLIF(btrim(split_part(
      COALESCE(current_setting('request.headers', true)::json->>'x-forwarded-for', ''),
      ',', 1)), '')
  );
  IF client_ip IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.response_respondents (form_id, ip_hash)
  VALUES (NEW.form_id, encode(digest(client_ip, 'sha256'), 'hex'))
  ON CONFLICT DO NOTHING;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You have already responded to this form.'
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_one_response_per_respondent()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_one_response_per_respondent_trigger ON public.responses;
CREATE TRIGGER enforce_one_response_per_respondent_trigger
  BEFORE INSERT ON public.responses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_one_response_per_respondent();
