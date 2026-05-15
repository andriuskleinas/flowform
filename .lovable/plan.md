## Goal
Prevent the browser's native autofill from surfacing previously-typed values in the "New Form" page inputs (questionnaire title, description, and question labels).

## Scope
Only `src/routes/forms.new.tsx` needs changes. No backend or schema work required.

## Plan
1. On the **Questionnaire title** `<Input>`, add:
   - `autoComplete="off"`
   - `data-1p-ignore` (disables 1Password)
   - `data-lpignore="true"` (disables LastPass)
   - Ensure the `id` and `name` are unique enough to avoid collision with common field names.

2. On the **Description** `<Textarea>`, add the same `autoComplete="off"` and password-manager hints.

3. On each **Question label** `<Input>`, add `autoComplete="off"` so old question labels don't appear as suggestions.

## Acceptance criteria
- Typing in the title/description/question fields does not show a dropdown of past entries.
- No other functionality changes.
