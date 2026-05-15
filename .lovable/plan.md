## Root cause

In TanStack Router's flat file-based routing, `src/routes/forms.$formId.tsx` is treated as a **layout route** for any sibling that extends its path — including `forms.$formId.edit.tsx` and `forms.$formId.responses.tsx`. A layout route MUST render `<Outlet />` for its children to appear.

`forms.$formId.tsx` instead renders the public form view (`PublicFormPage`) directly with no `<Outlet />`. Result: navigating to `/forms/<id>/edit` matches the edit route, but only the parent's public form view paints — that's why the editor controls (title input, question text, drag handles, delete buttons) are absent and "edit doesn't work."

The selected element's text on the current page confirms this: it's the public form's "You're viewing the public version of this form" / "Submit" content, not the editor.

## Fix

Convert the parent route into an index route so it stops acting as a layout.

1. **Rename `src/routes/forms.$formId.tsx` → `src/routes/forms.$formId.index.tsx`.**
   - Update the `createFileRoute` path from `"/forms/$formId"` to `"/forms/$formId/"`.
   - No other code changes — `PublicFormPage` keeps its current behavior, and links like `to="/forms/$formId"` continue to resolve to the same URL.

2. **Regenerate `routeTree.gen.ts`** (TanStack Router's Vite plugin does this automatically on dev/build; no manual edit).

After the rename, `/forms/$formId/edit` and `/forms/$formId/responses` are standalone leaf routes with no swallowing parent layout. The editor renders its title/description inputs, sortable question cards (drag handle, up/down/delete buttons, debounced inputs), and reorder works as already implemented.

No DB, RLS, dependency, or behavior changes elsewhere.