# Dashboard Polish

The current `/dashboard` already orders forms newest-first and shows a basic count. This pass focuses on visual polish: a cleaner two-column layout, a proper empty state, and a more prominent total count.

## Scope
Frontend-only edits to `src/routes/dashboard.tsx`. No schema, query, or routing changes.

## Layout
Switch the main area to a responsive 2-column grid on `md+`:
- **Left (sticky, 1/3)**: "New form" card — title input, optional description, "Save form" button. Stays in view as the list scrolls.
- **Right (2/3)**: "All forms" section with header row containing the H2 and a pill-style total count badge (e.g. `3 forms`) on the right.
- On mobile: stacks vertically, create-card on top.

Page header gets a subtle divider and keeps the existing H1 + subtitle.

## Forms list
- Render as cards in a single column (cleaner than current spacing), with hover lift and a small `FileText` icon next to each title.
- Show title (bold), description (muted, line-clamped to 2), and timestamp on the right.
- Cards keep newest-first ordering (already handled by the existing query).

## Empty state
Replace the current dashed box with a richer empty state inside the right column:
- Centered `FileText` icon in a soft brand-tinted circle
- Heading: "No forms yet"
- Body: "Create your first form using the panel on the left."
- Subtle dashed border, generous padding

## Loading state
Replace the plain "Loading…" text with 3 skeleton cards (using existing `Skeleton` component) so the layout doesn't jump.

## Count badge
Small rounded pill near the "All forms" heading: `{forms.length} {forms.length === 1 ? 'form' : 'forms'}`. Uses `bg-ink/5 text-ink/70`. Hidden while loading.

## Out of scope
- Auth, edit/delete, search/filter, pagination
- Backend changes
- Landing page changes
