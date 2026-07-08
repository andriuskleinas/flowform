-- Wave 6: custom thank-you message shown after a response is submitted.
ALTER TABLE public.forms
  ADD COLUMN thank_you_message text
  CHECK (thank_you_message IS NULL OR char_length(thank_you_message) <= 500);
