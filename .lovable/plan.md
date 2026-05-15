## Root cause

`src/routes/dashboard.tsx` imports `StatusPill` directly from the edit route file:

```ts
// src/routes/dashboard.tsx:10
import { StatusPill } from "./forms.$formId.edit";
```

TanStack Start's code-splitter treats files in `src/routes/` as route modules and rewrites them so they're loaded dynamically. Statically importing one route from another (especially one that pulls in `@dnd-kit`, `useSortable`, etc.) breaks that contract — the edit chunk fails to load and the runtime ends up on the root 404 page (`Failed to fetch dynamically imported module: virtual:tanstack-start-client-entry`).

That's why clicking the Edit pencil on the dashboard lands on a 404 instead of the editor.

## Fix

Extract `StatusPill` into a shared component and import it from both files.

1. **Create `src/components/status-pill.tsx`** — move the component (the `published`/`draft` pill, lines 711–724 of `forms.$formId.edit.tsx`) verbatim into a standalone file with a named export.

2. **Update `src/routes/dashboard.tsx`** — replace
   `import { StatusPill } from "./forms.$formId.edit";`
   with
   `import { StatusPill } from "@/components/status-pill";`.

3. **Update `src/routes/forms.$formId.edit.tsx`** — import `StatusPill` from `@/components/status-pill` and delete the local `export function StatusPill(...)` block at the bottom of the file.

No schema, RLS, or behavior changes. Editing functionality (title, description, questions, reorder, publish) stays exactly as built.