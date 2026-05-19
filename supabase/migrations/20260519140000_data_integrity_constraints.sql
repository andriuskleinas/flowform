-- Data integrity guardrails — server-side enforcement of length and size
-- limits that were previously only validated on the client. Without these,
-- a direct PostgREST call from a holder of any valid Supabase token could
-- write an arbitrarily large JSONB blob into responses.answers, etc.
--
-- All constraints are added with NOT VALID so this migration cannot fail on
-- existing rows. To enforce against historical data, run:
--   ALTER TABLE <table> VALIDATE CONSTRAINT <constraint_name>;
-- after reviewing offenders, e.g.:
--   SELECT id FROM public.responses
--   WHERE octet_length(answers::text) > 5000000;

-- ---------------------------------------------------------------------------
-- forms
-- ---------------------------------------------------------------------------
ALTER TABLE public.forms
  ADD CONSTRAINT forms_title_length
    CHECK (char_length(title) BETWEEN 1 AND 300) NOT VALID;

ALTER TABLE public.forms
  ADD CONSTRAINT forms_description_length
    CHECK (description IS NULL OR char_length(description) <= 2000) NOT VALID;

-- ---------------------------------------------------------------------------
-- questions
-- ---------------------------------------------------------------------------
ALTER TABLE public.questions
  ADD CONSTRAINT questions_label_length
    CHECK (char_length(label) BETWEEN 1 AND 300) NOT VALID;

-- 50 KB is generous for the structured option shapes we currently store
-- (string[] for multiple_choice, { max: number } for rating).
ALTER TABLE public.questions
  ADD CONSTRAINT questions_options_size
    CHECK (options IS NULL OR octet_length(options::text) <= 50000) NOT VALID;

-- ---------------------------------------------------------------------------
-- responses
-- ---------------------------------------------------------------------------
-- Client enforces MAX_ANSWER_LENGTH = 5000 per text answer. With a generous
-- ceiling for forms with many questions, cap the total payload at 5 MB so a
-- single malicious response can't fill the table.
ALTER TABLE public.responses
  ADD CONSTRAINT responses_answers_size
    CHECK (octet_length(answers::text) <= 5000000) NOT VALID;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_display_name_length
    CHECK (display_name IS NULL OR char_length(display_name) <= 200) NOT VALID;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_first_name_length
    CHECK (first_name IS NULL OR char_length(first_name) <= 100) NOT VALID;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_last_name_length
    CHECK (last_name IS NULL OR char_length(last_name) <= 100) NOT VALID;
