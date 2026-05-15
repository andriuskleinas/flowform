## Goal
Switch the form editor from auto-save to **explicit save**. Until the user clicks **Save**, every edit (title, description, question text, type, options, reorder, add, delete) lives only in local draft state. If they navigate away or click **Discard**, the form returns to whatever is currently in the database.

## Scope
File: `src/routes/forms.$formId.edit.tsx` only. No DB schema changes. Public form, dashboard, and responses are unaffected.

## Local draft model

When server data loads, mirror it into local state:
```
const [draftForm, setDraftForm] = useState<{ title; description }>(...);
const [draftQuestions, setDraftQuestions] = useState<DraftQuestion[]>(...);
```

`DraftQuestion` extends `Question` with two extra flags:
- `isNew: boolean` — created locally, not yet in DB. Uses a temporary client ID (e.g. `tmp-${nanoid}`).
- `isDeleted: boolean` — marked for deletion on save; hidden from the editor UI but kept in the array so the diff knows to delete the original row.

All editor handlers (title input, description input, sortable card label/options/type/reorder/add/delete) mutate ONLY `draftForm` / `draftQuestions`. No Supabase calls fire on every keystroke.

## Dirty detection

Compute `isDirty` by comparing draft to the original server snapshot (form fields, plus serialized question list ordered by position with id/type/label/options). Show:
- A small "Unsaved changes" pill near the title.
- A `useBlocker` confirmation when the user tries to navigate away with `isDirty === true`.
- Browser `beforeunload` guard while dirty.

## Save action

A **Save** button (top toolbar, next to Preview, primary brand color) runs ONE coordinated mutation that, against the original server snapshot:
1. Updates `forms` row if title/description changed.
2. Inserts each `isNew && !isDeleted` question (server returns real ID).
3. Deletes each `!isNew && isDeleted` question.
4. Updates each existing question whose label/type/options changed.
5. Writes `position` for every still-present question based on its index in the draft order.

Wraps the whole thing in try/catch. On success: `toast.success("Saved")`, refresh queries, reset draft from new server data, clear dirty flag. On error: `toast.error(...)`, leave draft untouched so the user can retry.

The Save button is disabled when `!isDirty` or while saving (shows "Saving…").

## Discard action

A secondary **Discard** button (only visible when dirty) re-initializes draft state from the current cached server data and clears dirty. Confirms via a small inline `<AlertDialog>` since it throws away work.

## Publish/Unpublish

Stays as-is (immediate status toggle — it's metadata, not content). The Publish button gets disabled while `isDirty` with tooltip "Save your changes first" so users can't publish stale content.

## Out of scope
- Optimistic UI for individual edits (no longer needed — everything is local until Save)
- Conflict detection if the form was edited in another tab between load and save (left as a future improvement)
- No change to Preview modal — it already reads `form` and `questions`; we'll point it at the draft so previews reflect unsaved edits