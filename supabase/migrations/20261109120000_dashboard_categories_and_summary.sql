-- Dashboard: form categories + workspace analytics summary.
--
-- 1. forms.category — optional free-text label (e.g. "Events", "HR") the
--    owner uses to group forms on the dashboard. NULL = uncategorized.
ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS category text
  CHECK (category IS NULL OR (char_length(btrim(category)) BETWEEN 1 AND 40));

-- 2. get_dashboard_forms — now also returns category and last_response_at.
--    The return type changes, so the function must be dropped first.
DROP FUNCTION IF EXISTS public.get_dashboard_forms();

CREATE FUNCTION public.get_dashboard_forms()
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  created_at timestamptz,
  status text,
  category text,
  response_count bigint,
  question_count bigint,
  last_response_at timestamptz
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
    f.category,
    (SELECT COUNT(*) FROM public.responses r WHERE r.form_id = f.id) AS response_count,
    (SELECT COUNT(*) FROM public.questions q WHERE q.form_id = f.id) AS question_count,
    (SELECT MAX(r.submitted_at) FROM public.responses r WHERE r.form_id = f.id) AS last_response_at
  FROM public.forms f
  WHERE f.user_id = auth.uid()
  ORDER BY f.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_dashboard_forms() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_forms() TO authenticated;

-- 3. get_dashboard_summary — workspace-wide aggregates for the caller's
--    forms: response totals, views/starts over the window (form_events has
--    no RLS policies, hence SECURITY DEFINER with an explicit auth.uid()
--    scope), and a per-day response series for the sparkline.
CREATE OR REPLACE FUNCTION public.get_dashboard_summary(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  days int := LEAST(GREATEST(COALESCE(p_days, 30), 7), 365);
  win_start timestamptz := date_trunc('day', now()) - make_interval(days => days - 1);
  prev_start timestamptz := win_start - make_interval(days => days);
  result jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  WITH my_forms AS (
    SELECT id FROM public.forms WHERE user_id = uid
  ),
  my_responses AS (
    SELECT r.form_id, r.submitted_at
    FROM public.responses r
    JOIN my_forms f ON f.id = r.form_id
  ),
  my_events AS (
    SELECT e.kind, e.occurred_at
    FROM public.form_events e
    JOIN my_forms f ON f.id = e.form_id
    WHERE e.occurred_at >= win_start AND e.kind IN ('view', 'start')
  )
  SELECT jsonb_build_object(
    'days', days,
    'total_responses', (SELECT COUNT(*) FROM my_responses),
    'responses_window', (SELECT COUNT(*) FROM my_responses WHERE submitted_at >= win_start),
    'responses_prev_window', (
      SELECT COUNT(*) FROM my_responses
      WHERE submitted_at >= prev_start AND submitted_at < win_start
    ),
    'views_window', (SELECT COUNT(*) FROM my_events WHERE kind = 'view'),
    'starts_window', (SELECT COUNT(*) FROM my_events WHERE kind = 'start'),
    'daily', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('day', d.day::date, 'count', COALESCE(c.n, 0))
                                ORDER BY d.day), '[]'::jsonb)
      FROM generate_series(win_start, date_trunc('day', now()), interval '1 day') AS d(day)
      LEFT JOIN (
        SELECT date_trunc('day', submitted_at) AS day, COUNT(*) AS n
        FROM my_responses
        WHERE submitted_at >= win_start
        GROUP BY 1
      ) c ON c.day = d.day
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_summary(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(int) TO authenticated;
