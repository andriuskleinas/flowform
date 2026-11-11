-- Categories become first-class, and the dashboard gets popularity stats.
--
-- 1. form_categories — a user's own topics, with a colour. They can exist
--    before any form uses them, and renaming/deleting one affects every form
--    in it at once.
-- 2. forms.category_id — replaces the free-text forms.category. A composite FK
--    (category_id, user_id) guarantees a form can only point at its owner's
--    category; deleting the category un-categorizes its forms.
--    The legacy forms.category column is left in place (no longer read or
--    written) so the previous app build keeps working until it is redeployed.
--    Drop it in a later migration.
-- 3. get_dashboard_forms — adds category_id/colour plus responses_7d,
--    responses_90d and views_90d for the Trending sort and completion rate.
--    form_events has no client read policy, so the function is now
--    SECURITY DEFINER and filters strictly to auth.uid().

-- ---------------------------------------------------------------------------
-- 1. Categories
-- ---------------------------------------------------------------------------
CREATE TABLE public.form_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL
    CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 40),
  color text NOT NULL DEFAULT 'slate'
    CHECK (color IN ('slate', 'blue', 'teal', 'green', 'amber', 'orange', 'red', 'pink', 'violet')),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Target of the composite FK from forms.
  UNIQUE (id, user_id)
);

-- One "Events" per user, case-insensitively.
CREATE UNIQUE INDEX form_categories_user_name_key
  ON public.form_categories (user_id, lower(name));

ALTER TABLE public.form_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own categories" ON public.form_categories
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can create their own categories" ON public.form_categories
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own categories" ON public.form_categories
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete their own categories" ON public.form_categories
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. forms.category_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.forms ADD COLUMN category_id uuid;

ALTER TABLE public.forms
  ADD CONSTRAINT forms_category_fkey
  FOREIGN KEY (category_id, user_id)
  REFERENCES public.form_categories (id, user_id)
  ON DELETE SET NULL (category_id);

CREATE INDEX forms_category_id_idx ON public.forms (category_id);

-- Backfill from the free-text column: one category per distinct name per
-- user (case-insensitive), colours assigned round-robin.
INSERT INTO public.form_categories (user_id, name, color)
SELECT user_id, name,
       (ARRAY['blue','teal','green','amber','orange','red','pink','violet','slate'])
         [((row_number() OVER (PARTITION BY user_id ORDER BY lower(name)) - 1) % 9) + 1]
FROM (
  SELECT DISTINCT ON (user_id, lower(btrim(category)))
         user_id, left(btrim(category), 40) AS name
  FROM public.forms
  WHERE category IS NOT NULL AND btrim(category) <> ''
  ORDER BY user_id, lower(btrim(category)), created_at
) s;

UPDATE public.forms f
SET category_id = c.id
FROM public.form_categories c
WHERE f.category IS NOT NULL
  AND c.user_id = f.user_id
  AND lower(c.name) = lower(left(btrim(f.category), 40));

-- ---------------------------------------------------------------------------
-- 3. Dashboard RPC
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_dashboard_forms();

CREATE FUNCTION public.get_dashboard_forms()
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  created_at timestamptz,
  status text,
  category_id uuid,
  category text,
  category_color text,
  response_count bigint,
  question_count bigint,
  last_response_at timestamptz,
  responses_7d bigint,
  responses_90d bigint,
  views_90d bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id,
    f.title,
    f.description,
    f.created_at,
    f.status,
    f.category_id,
    c.name,
    c.color,
    rs.total,
    (SELECT COUNT(*) FROM public.questions q WHERE q.form_id = f.id),
    rs.last_at,
    rs.d7,
    rs.d90,
    ev.views
  FROM public.forms f
  LEFT JOIN public.form_categories c ON c.id = f.category_id
  CROSS JOIN LATERAL (
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE r.submitted_at > now() - interval '7 days') AS d7,
           COUNT(*) FILTER (WHERE r.submitted_at > now() - interval '90 days') AS d90,
           MAX(r.submitted_at) AS last_at
    FROM public.responses r
    WHERE r.form_id = f.id
  ) rs
  CROSS JOIN LATERAL (
    SELECT COUNT(*) AS views
    FROM public.form_events e
    WHERE e.form_id = f.id
      AND e.kind = 'view'
      AND e.occurred_at > now() - interval '90 days'
  ) ev
  WHERE f.user_id = auth.uid()
  ORDER BY f.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_dashboard_forms() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_forms() TO authenticated;
