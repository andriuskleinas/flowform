## Symptom
Clicking the chart icon on the dashboard navigates to `/forms/<id>/responses` and shows the 404 / error page instead of the analytics view I just built.

## Root cause
`src/routes/forms.$formId.responses.tsx` (the analytics page) has two issues that break it during the initial server render:

1. **Recharts crashes in SSR.** `ResponsiveContainer` reads `window` / `ResizeObserver` at render time. In TanStack Start every route is SSR'd, so the page throws on the server before mount and the router falls back to its error/404 boundary.
2. **Invalid color values.** Charts use `hsl(var(--primary))`, but the project's tokens in `src/styles.css` are already full `oklch(...)` values, so the wrapper produces invalid CSS like `hsl(oklch(...))`. Even when SSR works, bars/lines render blank.

## Fix
Edit only `src/routes/forms.$formId.responses.tsx`:

- Gate every Recharts subtree behind a small `<ClientOnly>` component (renders `null` on the server, real chart on the client via a `useEffect` mount flag). Show a fixed-height skeleton placeholder while not mounted so layout doesn't jump.
- Replace every `hsl(var(--token))` with the raw token reference `var(--token)` (works because tokens are already complete color functions).
- Verify in the live preview: click the chart icon on a form card → the responses page renders with summary cards, line chart, and per-question charts; refreshing the page also works.

No DB, dashboard, or routing changes needed.
