-- Wave 2: question model upgrade.
--
-- 1. Per-question required flag. Defaults to true because until now every
--    question was implicitly required (the submit button stayed disabled
--    until everything was answered), so existing forms keep their behavior.
ALTER TABLE public.questions
  ADD COLUMN required boolean NOT NULL DEFAULT true;

-- 2. New question types:
--      long_text — multi-line free text
--      dropdown  — single choice from a select (options: string[])
--      yes_no    — fixed Yes/No (options: null)
--      nps       — 0-10 likelihood scale (options: null)
--    multiple_choice options may now also be
--      { "choices": string[], "multi": boolean }
--    (legacy plain string[] rows mean multi-select, matching old behavior).
ALTER TABLE public.questions DROP CONSTRAINT questions_type_check;
ALTER TABLE public.questions
  ADD CONSTRAINT questions_type_check
    CHECK (type IN ('text', 'long_text', 'multiple_choice', 'dropdown', 'yes_no', 'nps', 'rating'));
