## Changes to `src/routes/dashboard.tsx`

**1. Add a "Question type" dropdown to the Create dialog**

Below the Description textarea, add a `<select>` with three options:
- Short answer (`text`)
- Multiple choice (`multiple_choice`)
- Rating scale (`rating`)

Default: `text`. State: `const [questionType, setQuestionType] = useState<"text" | "multiple_choice" | "rating">("text")`.

**2. On save, create the form AND seed a first question**

Update `createForm.mutationFn`:
- Insert the form, get back its `id` (already done).
- Then insert one row into `questions` with `form_id = newId`, `position = 0`, `label = "Untitled question"`, and type-specific defaults matching the editor:
  - `text` → `options: null`
  - `multiple_choice` → `options: ["Option 1", "Option 2"]`
  - `rating` → `options: { max: 5 }`
- Navigate to `/forms/$formId/edit` (already done).

Reset `questionType` back to `text` when the dialog closes.

**3. Remove the dark backdrop on this dialog only**

In `src/components/ui/dialog.tsx`, the default overlay is `bg-black/80`. Don't change the shared component — instead, in `dashboard.tsx` render a custom `<DialogOverlay className="bg-transparent" />` inside `<DialogPortal>` for this dialog only, so other dialogs in the app keep their normal backdrop.

Concretely: import `DialogOverlay` and `DialogPortal` from `@/components/ui/dialog`, and replace `<DialogContent>...` with `<DialogPortal><DialogOverlay className="bg-transparent" /><DialogContent>...</DialogContent></DialogPortal>`. Also add a soft `shadow-2xl` and `border` to the content so it stays visually anchored without the dim backdrop.

No DB schema changes, no other files touched.