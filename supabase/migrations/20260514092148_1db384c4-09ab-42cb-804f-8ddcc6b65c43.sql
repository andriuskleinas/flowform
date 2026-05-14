-- Questions table
CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('text','multiple_choice','rating')),
  label text NOT NULL,
  options jsonb,
  position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_questions_form_position ON public.questions(form_id, position);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view questions"
  ON public.questions FOR SELECT
  USING (true);

CREATE POLICY "Owners can insert questions"
  ON public.questions FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id AND f.user_id = auth.uid()));

CREATE POLICY "Owners can update questions"
  ON public.questions FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id AND f.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id AND f.user_id = auth.uid()));

CREATE POLICY "Owners can delete questions"
  ON public.questions FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id AND f.user_id = auth.uid()));

-- Responses table
CREATE TABLE public.responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  answers jsonb NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_responses_form ON public.responses(form_id);

ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a response"
  ON public.responses FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id));

CREATE POLICY "Owners can view responses"
  ON public.responses FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id AND f.user_id = auth.uid()));

-- Allow public read of forms (needed for public fill page). Owner policy stays.
CREATE POLICY "Anyone can view forms"
  ON public.forms FOR SELECT
  USING (true);
