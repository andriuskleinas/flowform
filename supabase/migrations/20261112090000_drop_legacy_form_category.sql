-- Drop the legacy free-text forms.category column.
--
-- Replaced by forms.category_id → form_categories in
-- 20261111180000_form_categories_and_popularity.sql, and kept only until the
-- build that stopped reading/writing it was live (deployed 2026-11-11).
-- Its CHECK constraint (forms_category_check) goes with it.
ALTER TABLE public.forms DROP COLUMN IF EXISTS category;
