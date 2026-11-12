-- One response per respondent per survey VERSION.
--
-- "Update this survey" (form versioning) keeps the same link, so people who
-- answered v1 are often exactly who the owner wants to hear from about v2.
-- The claim table now records the version, and the claim is per
-- (form, version, hashed IP).
--
-- Note: triggers fire alphabetically, so this one runs before
-- responses_stamp_form_version; it reads the live version from forms itself
-- instead of trusting NEW.form_version.

ALTER TABLE public.response_respondents
  ADD COLUMN form_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.response_respondents
  DROP CONSTRAINT response_respondents_pkey,
  ADD CONSTRAINT response_respondents_pkey PRIMARY KEY (form_id, form_version, ip_hash);

CREATE OR REPLACE FUNCTION public.enforce_one_response_per_respondent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  client_ip text;
  live_version integer;
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

  SELECT f.version INTO live_version FROM public.forms f WHERE f.id = NEW.form_id;

  INSERT INTO public.response_respondents (form_id, form_version, ip_hash)
  VALUES (NEW.form_id, COALESCE(live_version, 1), encode(digest(client_ip, 'sha256'), 'hex'))
  ON CONFLICT DO NOTHING;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You have already responded to this form.'
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;
