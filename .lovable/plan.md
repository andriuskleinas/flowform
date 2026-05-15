## Goal
Replace the always-visible right-column Preview pane in the editor with a **"Preview" button** that opens a modal showing the form exactly as a respondent would see it.

## Changes (single file: `src/routes/forms.$formId.edit.tsx`)

1. **Remove the right-column `<section>` Preview block** (lines 382–397). The Questions section becomes full-width — change `lg:grid-cols-2` to a single column on the wrapping `<div>` (or drop the grid entirely).

2. **Add a "Preview" button** in the top toolbar next to the existing "Preview public form" external link (around line 262). Use the `Eye` icon from lucide-react. Style it as a subtle outline button matching the toolbar's visual weight.

3. **Replace the external "Preview public form" link with the modal trigger** — opening a new tab is redundant once an in-app preview exists. Keep just one Preview entry point.

4. **Add a shadcn `Dialog`** (already available in `@/components/ui/dialog`) that renders the respondent view inside:
   - Title: form title
   - Optional description
   - Each question rendered with `<QuestionRender question={q} value={undefined} disabled />` (same disabled preview pattern already in use)
   - A disabled "Submit" button at the bottom for visual fidelity
   - Empty state when no questions yet
   - Scrollable body (`max-h-[80vh] overflow-y-auto`) since long forms won't fit

5. **No data, no routing, no DB changes.** Pure UI rearrangement using existing `questions` and `form` state already in the component.

## Result
- Editor: full-width questions list, no split layout
- Toolbar: single "Preview" button → opens modal showing the respondent's view
- Live edits to title/description/questions reflect immediately when reopening the modal (same reactive state)