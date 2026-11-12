-- Short share links: /f/<first 8 hex chars of the form id>.
--
-- Used under the QR code in live results mode, where the full UUID URL is too
-- long to read off a projector. Only published or closed forms resolve (the
-- same forms anyone can already open), and an ambiguous prefix resolves to
-- nothing rather than to the wrong survey.
CREATE OR REPLACE FUNCTION public.resolve_short_form_link(p_code text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ids uuid[];
BEGIN
  -- Validate before building the uuid bounds, so bad input never hits a cast.
  IF p_code IS NULL OR p_code !~ '^[0-9a-f]{8}$' THEN
    RETURN NULL;
  END IF;
  SELECT array_agg(f.id) INTO ids
  FROM public.forms f
  WHERE f.status IN ('published', 'closed')
    AND f.id BETWEEN (p_code || '-0000-0000-0000-000000000000')::uuid
                 AND (p_code || '-ffff-ffff-ffff-ffffffffffff')::uuid;
  RETURN CASE WHEN cardinality(ids) = 1 THEN ids[1] END;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_short_form_link(text) FROM public;
GRANT EXECUTE ON FUNCTION public.resolve_short_form_link(text) TO anon, authenticated;
