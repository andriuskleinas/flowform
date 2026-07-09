-- Server-side shape validation for questions.options / questions.logic.
--
-- Previously only a 50 KB size cap guarded these jsonb columns, so an authed
-- user hitting PostgREST directly could store junk shapes in their own forms
-- (a string, a number, a wrong-keyed object). Renderers are defensive, so the
-- blast radius was a broken-looking own form — but the DB should reject
-- structurally invalid shapes outright.
--
-- These validate STRUCTURE only (matching what defaultOptionsForType /
-- getChoiceConfig produce and getRatingMax reads). Semantic validity — that a
-- jump target is a real later question — stays client-side (sanitizeLogic) and
-- is handled defensively at render (resolveNextIndex). Existing rows were
-- surveyed and all conform, so these are added VALID.
--
--   options by type:
--     text / long_text / yes_no / nps → NULL
--     rating                          → { "max": <number> }
--     dropdown                        → [ ...strings ]   (jsonb array)
--     multiple_choice                 → [ ...strings ]   (legacy = multi)
--                                       or { "choices": [ ... ], "multi": bool }
--   logic:
--     NULL, or an object; if it has a "jumps" key that must be an object.

-- Note: a CHECK passes when its expression is TRUE *or NULL* — so the key
-- existence guards (options ? 'max' / options ? 'choices') are required.
-- Without them, jsonb_typeof(options -> '<missing key>') returns NULL, the
-- comparison is NULL, and a junk object (e.g. {"foo":1}) would slip through.
ALTER TABLE public.questions
  ADD CONSTRAINT questions_options_shape CHECK (
    options IS NULL OR
    CASE type
      WHEN 'rating' THEN
        jsonb_typeof(options) = 'object'
        AND (options ? 'max') AND jsonb_typeof(options -> 'max') = 'number'
      WHEN 'dropdown' THEN
        jsonb_typeof(options) = 'array'
      WHEN 'multiple_choice' THEN
        jsonb_typeof(options) = 'array'
        OR (jsonb_typeof(options) = 'object'
            AND (options ? 'choices') AND jsonb_typeof(options -> 'choices') = 'array')
      ELSE
        FALSE  -- text, long_text, yes_no, nps must have NULL options
    END
  );

ALTER TABLE public.questions
  ADD CONSTRAINT questions_logic_shape CHECK (
    logic IS NULL OR (
      jsonb_typeof(logic) = 'object'
      AND (NOT (logic ? 'jumps') OR jsonb_typeof(logic -> 'jumps') = 'object')
    )
  );
