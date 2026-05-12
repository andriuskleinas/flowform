CREATE TABLE public.forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view forms" ON public.forms FOR SELECT USING (true);
CREATE POLICY "Anyone can create forms" ON public.forms FOR INSERT WITH CHECK (true);

CREATE INDEX forms_created_at_idx ON public.forms (created_at DESC);