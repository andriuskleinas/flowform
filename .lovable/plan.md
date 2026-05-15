## Goal
Make "Multiple choice" questions actually allow selecting multiple options (checkboxes), instead of single-pick radio buttons.

## Changes

### 1. `src/components/question-render.tsx`
Replace the `RadioGroup` block for `multiple_choice` with a checkbox list using shadcn's `Checkbox`.

- Treat `value` as `string[]` (default to `[]` when not array).
- On toggle, call `onChange?.(checked ? [...selected, opt] : selected.filter(x => x !== opt))`.
- Keep the same "No options yet" empty state and italic placeholder for blank option labels.

### 2. `src/routes/forms.$formId.index.tsx` — `allAnswered` validation (line 65)
Change from:
```
if (q.type === "multiple_choice") return typeof v === "string" && v.length > 0;
```
to:
```
if (q.type === "multiple_choice") return Array.isArray(v) && v.length > 0;
```

### 3. `src/routes/forms.$formId.responses.tsx` — `AnswerView` (line 143)
Render array values as a comma-joined list (or bullet list) so submitted multi-select answers display correctly. Keep the "No answer" empty state when array is empty.

### 4. Backward compatibility
Old responses stored as a single string remain valid JSON. In `AnswerView`, if `value` is a string for a `multiple_choice` question, render it as-is. In `QuestionRender`, if incoming `value` is a string (legacy), coerce to `[value]` before rendering checkbox state.

## Out of scope
- No DB migration. `answers` is `jsonb` and already accepts arrays.
- No change to the editor's option-list editing UI — the question authoring side stays identical.
- No change to question type enum or "Add question" menu label (still "Multiple choice", which now correctly means multi-select).