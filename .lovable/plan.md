## Goal
Make the dashboard's empty state more inviting with a prominent "Create your first form" CTA button.

## Current state
The dashboard already shows an empty state in the right column when `forms.length === 0` — a `FileText` icon, "No forms yet" heading, and a body line ("Create your first form using the panel on the left"). It has no button.

## Change (frontend only — `src/routes/dashboard.tsx`)
- Add a `useRef<HTMLInputElement>` on the title `Input` and a `focusCreate()` helper that calls `titleRef.current?.focus()` and `scrollIntoView({ behavior: "smooth", block: "center" })`.
- In the empty-state card, add a primary brand button "Create your first form" below the body text. Clicking it calls `focusCreate()` so the user lands on the title field with the create card scrolled into view (important on mobile, where the create card sits above the list, and on desktop where the sticky card is already visible but should still get focus).
- Soften the body copy to "You haven't created any forms yet. Get started below." so it reads naturally with the button underneath.
- Keep the existing icon, dashed border, and overall card styling — just add the CTA.

## Out of scope
- Modal / drawer for form creation
- Animations beyond the existing scroll/focus
- Any backend or schema change
