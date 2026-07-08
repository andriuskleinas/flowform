-- Wave 5: funnel analytics.
--
-- 1. form_events — respondent-side events for published forms:
--      view  — public form page loaded
--      start — first interaction with a question
--      reach — a question was shown (conversational mode only)
--    IPs are hashed (same approach as the response rate limit) and events
--    are deduped per (form, ip, kind, question) within 30 minutes, so
--    counts approximate unique visitors rather than raw page loads.
CREATE TABLE public.form_events (
  id bigserial PRIMARY KEY,
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  question_id uuid REFERENCES public.questions(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('view', 'start', 'reach')),
  ip_hash text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX form_events_form_kind_time_idx
  ON public.form_events (form_id, kind, occurred_at DESC);
CREATE INDEX form_events_dedupe_idx
  ON public.form_events (form_id, ip_hash, kind, occurred_at DESC);

-- No direct client access: RLS enabled with no policies. Writes go through
-- record_form_event(); reads through get_form_analytics().
ALTER TABLE public.form_events ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- record_form_event — called from the public form page (anon or signed-in).
-- ---------------------------------------------------------------------------
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

REVOKE ALL ON FUNCTION public.record_form_event(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_form_event(uuid, text, uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- get_form_analytics — owner-only aggregate over ALL responses and events,
-- removing the client-side 100-response cap. SECURITY DEFINER because
-- form_events has no RLS policies; ownership is checked explicitly.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_form_analytics(p_form_id uuid, p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  days int := LEAST(GREATEST(COALESCE(p_days, 30), 1), 365);
  win timestamptz := now() - make_interval(days => LEAST(GREATEST(COALESCE(p_days, 30), 1), 365));
  result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.forms f WHERE f.id = p_form_id AND f.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'totals', (
      SELECT jsonb_build_object(
        'responses', COUNT(*),
        'last7', COUNT(*) FILTER (WHERE submitted_at > now() - interval '7 days'),
        'avg_fill_seconds', AVG(EXTRACT(EPOCH FROM (submitted_at - started_at))) FILTER (
          WHERE started_at IS NOT NULL
            AND submitted_at > started_at
            AND submitted_at - started_at < interval '2 hours'
        ),
        'timed_count', COUNT(*) FILTER (
          WHERE started_at IS NOT NULL
            AND submitted_at > started_at
            AND submitted_at - started_at < interval '2 hours'
        )
      )
      FROM public.responses r
      WHERE r.form_id = p_form_id
    ),
    'funnel', jsonb_build_object(
      'views', (
        SELECT COUNT(*) FROM public.form_events e
        WHERE e.form_id = p_form_id AND e.kind = 'view' AND e.occurred_at > win
      ),
      'starts', (
        SELECT COUNT(*) FROM public.form_events e
        WHERE e.form_id = p_form_id AND e.kind = 'start' AND e.occurred_at > win
      ),
      'submits', (
        SELECT COUNT(*) FROM public.responses r
        WHERE r.form_id = p_form_id AND r.submitted_at > win
      )
    ),
    'trend', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object('day', to_char(d.day, 'YYYY-MM-DD'), 'count', COALESCE(c.cnt, 0))
          ORDER BY d.day
        ),
        '[]'::jsonb
      )
      FROM generate_series(
        date_trunc('day', now()) - make_interval(days => days - 1),
        date_trunc('day', now()),
        interval '1 day'
      ) AS d(day)
      LEFT JOIN (
        SELECT date_trunc('day', submitted_at) AS day, COUNT(*) AS cnt
        FROM public.responses
        WHERE form_id = p_form_id
          AND submitted_at > date_trunc('day', now()) - make_interval(days => days - 1)
        GROUP BY 1
      ) c ON c.day = d.day
    ),
    'reach', (
      SELECT COALESCE(
        jsonb_agg(jsonb_build_object('question_id', t.question_id, 'count', t.cnt)),
        '[]'::jsonb
      )
      FROM (
        SELECT question_id, COUNT(*) AS cnt
        FROM public.form_events
        WHERE form_id = p_form_id AND kind = 'reach' AND question_id IS NOT NULL
        GROUP BY question_id
      ) t
    ),
    'value_counts', (
      SELECT COALESCE(
        jsonb_agg(jsonb_build_object('question_id', t.qid, 'value', t.val, 'count', t.cnt)),
        '[]'::jsonb
      )
      FROM (
        SELECT
          a.key AS qid,
          CASE WHEN jsonb_typeof(a.value) = 'array' THEN e.val ELSE a.value #>> '{}' END AS val,
          COUNT(*) AS cnt
        FROM public.responses r
        CROSS JOIN LATERAL jsonb_each(r.answers) AS a(key, value)
        LEFT JOIN LATERAL jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(a.value) = 'array' THEN a.value ELSE '[]'::jsonb END
        ) AS e(val) ON true
        JOIN public.questions q
          ON q.id::text = a.key
         AND q.form_id = p_form_id
         AND q.type NOT IN ('text', 'long_text')
        WHERE r.form_id = p_form_id
          AND (jsonb_typeof(a.value) <> 'array' OR e.val IS NOT NULL)
        GROUP BY 1, 2
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_form_analytics(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_form_analytics(uuid, int) TO authenticated;

-- ---------------------------------------------------------------------------
-- Owners can delete individual responses (spam cleanup).
-- ---------------------------------------------------------------------------
CREATE POLICY "Owners can delete responses"
  ON public.responses FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.forms f WHERE f.id = form_id AND f.user_id = auth.uid()
  ));
