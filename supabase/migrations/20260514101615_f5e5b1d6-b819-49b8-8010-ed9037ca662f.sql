-- 1. Add status column
ALTER TABLE public.forms
  ADD COLUMN status text NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft', 'published'));

-- 2. Replace public SELECT policy on forms (only published visible to public)
DROP POLICY IF EXISTS "Anyone can view forms" ON public.forms;
CREATE POLICY "Anyone can view published forms"
  ON public.forms FOR SELECT
  TO public
  USING (status = 'published');

-- 3. Replace public SELECT policy on questions (only for published forms)
DROP POLICY IF EXISTS "Anyone can view questions" ON public.questions;
CREATE POLICY "Anyone can view questions of published forms"
  ON public.questions FOR SELECT
  TO public
  USING (EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = questions.form_id AND f.status = 'published'
  ));

-- Owners keep full read access via a dedicated policy
CREATE POLICY "Owners can view their questions"
  ON public.questions FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = questions.form_id AND f.user_id = auth.uid()
  ));

-- 4. Restrict response inserts to published forms
DROP POLICY IF EXISTS "Anyone can submit a response" ON public.responses;
CREATE POLICY "Anyone can submit response to published form"
  ON public.responses FOR INSERT
  TO public
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = responses.form_id AND f.status = 'published'
  ));