-- Wave 4: conversational display mode + logic jumps.
--
-- forms.display_mode:
--   'conversational' — one question at a time (default for new forms)
--   'classic'        — all questions on one page
-- Existing forms are backfilled to 'classic' so their live behavior
-- doesn't change out from under their owners.
ALTER TABLE public.forms
  ADD COLUMN display_mode text NOT NULL DEFAULT 'conversational'
  CHECK (display_mode IN ('classic', 'conversational'));

UPDATE public.forms SET display_mode = 'classic';

-- questions.logic — optional logic-jump rules, shape:
--   { "jumps": { "<choice value>": "<target question id>" | "end" } }
-- Only meaningful for single-choice questions (single-select
-- multiple_choice, dropdown, yes_no). Targets must be later questions;
-- the runtime treats invalid/stale targets as "next question".
ALTER TABLE public.questions ADD COLUMN logic jsonb;
