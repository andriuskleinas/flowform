## Goal

Replace the colored initials avatar (MC/DO/PR) on each testimonial card with a small generated company logo mark for Northwind, Lumen, and Axiom.

## Steps

1. Generate 3 transparent-background PNG logo marks (square, 512x512) into `src/assets/`:
   - `logo-northwind.png` — abstract pine/compass mark, dark green, premium minimalist
   - `logo-lumen.png` — geometric light/aperture mark, dark green, premium minimalist
   - `logo-axiom.png` — geometric A monogram / overlapping triangles, dark green, premium minimalist
   - All on a clean white background, single brand-green color, flat vector feel, no text.
2. In `src/routes/index.tsx`:
   - Import the 3 logo PNGs.
   - Add a `logo` field to each testimonial entry pointing to the imported asset.
   - Replace `initials` field usage with `logo`.
   - Swap the `<div>` initials avatar for an `<img>` of the logo, keeping the same `size-10 rounded-full` footprint with `bg-brand/10 p-1.5` so the mark sits in a soft brand tile, with proper `alt` text ("{Company} logo").
3. Remove the now-unused `initials` keys from the testimonials array.

## Out of scope

- No new section, no carousel, no real third-party logos, no design-token changes, no other card layout changes.
