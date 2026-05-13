## Goal
Hide the "New form" panel by default. It should only appear when the user clicks a "Create your first form" / "New form" button — opening a dialog where they fill in title + description.

## Current state
The left column of `/dashboard` always shows a sticky "New form" card with the title + description + Save form inputs. The empty state's "Create your first form" button focuses that always-visible input.

## Change (frontend only — `src/routes/dashboard.tsx`)

**Layout shift**: drop the 2-column grid. The forms list becomes the full width of the page. The header row above the list now contains:
- "All forms" heading + count pill (left)
- a primary "New form" button (right) — opens the dialog

**Dialog (shadcn `Dialog`)**: lifts the existing form into a modal.
- Triggered by both the header "New form" button and the empty-state "Create your first form" button via shared `open` state.
- Contains: `DialogHeader` ("Create a new form"), title `Input`, optional description `Textarea`, and a footer row with "Cancel" + "Save form".
- On successful save: close dialog, reset fields, toast, refetch (existing mutation logic — just add `setOpen(false)` in `onSuccess`).
- Auto-focus the title input when the dialog opens (Radix Dialog handles this by default for the first focusable element).

**Empty state**: button keeps its label "Create your first form" but now calls `setOpen(true)` instead of focusing a sticky input.

**Out of scope**: edit/delete, preview rendering of an actual filled-out form, validation beyond the existing required-title rule, schema changes.
