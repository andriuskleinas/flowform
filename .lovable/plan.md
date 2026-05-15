## Goal
Make question editing and reordering on the edit page (`/forms/:id/edit`) feel obvious and modern, with reorder that survives a page refresh.

## Current state
The edit page already wires up:
- Per-question label editing via blur-to-save (not very discoverable).
- Up/Down arrow buttons that swap `position` in the `questions` table, so reorder already persists across refresh.
- Editing of multiple-choice options and rating max.

## What's changing

### 1. Editable questions — clearer UX
In `src/routes/forms.$formId.edit.tsx`:
- Replace the blur-only label `<Input>` with a controlled input that:
  - Shows local edits immediately.
  - Auto-saves with a ~600 ms debounce, plus an explicit save on blur.
  - Shows a subtle "Saved" / "Saving…" hint next to the field.
- Same debounced behavior for multiple-choice option text edits and rating max changes (rating max is already instant; keep it).
- Add a "Question type" dropdown on each question card so users can switch type after creation. When switching, reset `options` to the new type's default (and warn nothing else).

### 2. Drag-and-drop reorder (persisted)
- Add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (small, accessible, no Node-only deps — Worker-safe).
- Wrap the questions list in `DndContext` + `SortableContext` (vertical list strategy).
- Each question card becomes a `useSortable` item with a drag handle (grip icon) on the left.
- On drop:
  - Optimistically reorder the local list.
  - Recalculate `position` for every question (0..n-1) and write the new positions in a single batched update sequence (loop of `update().eq('id', ...)`), then invalidate `["questions", formId]` and `["public-questions", formId]`.
  - On error, toast and re-fetch to revert.
- Keep the existing Up/Down arrows as a keyboard-friendly fallback (also useful on touch).

### 3. No schema changes
Reuses existing `questions.position` column and existing RLS policies (owners can update questions). No migration needed.

## Files touched
- `src/routes/forms.$formId.edit.tsx` — debounced label/option edits, type-switch dropdown, DnD wiring, batched-position save.
- `package.json` — add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.

## Acceptance
- Typing in a question label updates the DB without needing to click elsewhere; refresh keeps the edit.
- Dragging a question to a new spot updates order; refresh keeps the new order.
- Switching a question's type works and the options editor adapts.
- Existing publish/unpublish, preview, delete, and add-question flows still work.
