## Goal
Make the form title and description editable on `/forms/:id/edit` (question text is already editable inline, but the title/description aren't).

## Changes
**`src/routes/forms.$formId.edit.tsx`**
- Replace the static `<h1>{form.title}</h1>` and `<p>{form.description}</p>` in the header with a "Form details" card containing:
  - **Title** — `DebouncedInput` (required, max 120 chars). On change, mutate `forms.title`.
  - **Description** — debounced `<Textarea>` (optional, max 500 chars). On change, mutate `forms.description`.
- Add an `updateForm` mutation that calls `supabase.from("forms").update(patch).eq("id", formId)` and invalidates `["form", formId]`, `["forms"]`, and `["public-form", formId]`.
- Empty title is rejected (keep the previous saved value).
- Keep the `StatusPill` and Publish/Unpublish button next to the title row.

## Out of scope
- Question editing (already works via `DebouncedInput` on each question card).
- Schema, RLS — `forms` table already has owner-update policy via the migration; no DB changes.

## Acceptance
- Typing in title/description updates the DB after a short pause; refresh keeps the change.
- Dashboard list and public form page reflect the new title/description after save.
- Empty title is not persisted.
