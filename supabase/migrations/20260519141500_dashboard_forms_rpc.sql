-- Single-query RPC powering the dashboard list.
--
-- Before this migration the dashboard issued three round-trips: fetch all
-- forms, then `responses.form_id` rows via .in(), then `questions.form_id`
-- rows via .in(), then counted client-side. With many responses that
-- transfers thousands of rows just to compute two integers per form.
--
-- This RPC returns the same per-form aggregates in a single query. Run via
-- the client as `supabase.rpc("get_dashboard_forms")`. SECURITY INVOKER so
-- RLS still applies — the WHERE clause is auth.uid() and the count
-- subqueries inherit the owners-view-responses / owners-view-questions
-- policies, so users cannot use this to enumerate other users' data.

CREATE OR REPLACE FUNCTION public.get_dashboard_forms()
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  created_at timestamptz,
  status text,
  response_count bigint,
  question_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    f.id,
    f.title,
    f.description,
    f.created_at,
    f.status,
    (SELECT COUNT(*) FROM public.responses r WHERE r.form_id = f.id) AS response_count,
    (SELECT COUNT(*) FROM public.questions q WHERE q.form_id = f.id) AS question_count
  FROM public.forms f
  WHERE f.user_id = auth.uid()
  ORDER BY f.created_at DESC;
$$;

-- Lock down execution: only signed-in users may call this.
REVOKE EXECUTE ON FUNCTION public.get_dashboard_forms() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_forms() TO authenticated;
