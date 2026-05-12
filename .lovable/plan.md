## Goal

Drop the logo tile from each testimonial card. Keep only the name and role, both left-aligned beneath the quote.

## Changes in `src/routes/index.tsx`

- Remove the round logo tile `<div>` (and its `<img>`) from each testimonial card.
- Replace the wrapping `flex items-start gap-3` row with a plain `mt-8` block containing only name + role, left-aligned (default flow).
- Remove the unused `logo` and `company` fields from the `testimonials` array.
- Remove the three logo PNG imports (`logoNorthwind`, `logoLumen`, `logoAxiom`).

The logo PNG files in `src/assets/` are left on disk in case they're reused later.

## Out of scope

- No copy changes, no card border/shadow/quote styling changes, no other layout changes.
