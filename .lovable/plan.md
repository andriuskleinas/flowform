## What's already done

The form-creation flow you described is fully implemented:

- **Question types**: short answer, multiple choice, rating scale (1–N stars) — in `src/components/question-render.tsx`.
- **Builder page** (`src/routes/forms.$formId.edit.tsx`, owner-only):
  - Add question (dropdown picker for type)
  - Edit question label (saves on blur)
  - Edit options (multiple choice) and max stars (rating)
  - Reorder via up/down buttons (swaps `position`)
  - Delete question
  - Live preview pane on the right that mirrors what respondents see
- **Dashboard** opens any existing form into this editor (click the row or the pencil icon).

## The one gap

After submitting the "New form" dialog on the dashboard, the user is dropped back on the list and has to find the new row to start adding questions. Better: send them straight into the builder.

## Change

In `src/routes/dashboard.tsx`, in the `createForm` mutation:

1. Change the insert to `.select("id").single()` so it returns the new row's id.
2. In `onSuccess`, after the toast and dialog reset, call `navigate({ to: "/forms/$formId/edit", params: { formId: newId } })`.

No DB changes, no new routes, no other UI changes.

## Out of scope

Drag-and-drop reordering, required/optional toggle, question duplication, undo on delete — none were requested.
