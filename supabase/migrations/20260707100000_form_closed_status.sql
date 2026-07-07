-- Add a third form lifecycle state: 'closed'.
-- draft → published → closed (and back). A closed form stays publicly
-- visible so the share link can render a "this survey is closed" notice,
-- but its questions are hidden and response inserts remain published-only.

ALTER TABLE public.forms DROP CONSTRAINT forms_status_check;
ALTER TABLE public.forms
  ADD CONSTRAINT forms_status_check
    CHECK (status IN ('draft', 'published', 'closed'));

-- Public can see published AND closed forms (row needed to render the
-- closed notice). Draft stays owner-only.
DROP POLICY IF EXISTS "Anyone can view published forms" ON public.forms;
CREATE POLICY "Anyone can view published or closed forms"
  ON public.forms FOR SELECT
  TO public
  USING (status IN ('published', 'closed'));

-- Question visibility and response inserts intentionally stay
-- published-only: closed forms expose no questions and accept no
-- responses. Existing policies already enforce this.
