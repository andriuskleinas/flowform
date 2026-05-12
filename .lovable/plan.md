## Goal

Make each company logo fill its circular tile fully, with no inner padding gap.

## Change

In `src/routes/index.tsx`, on the testimonial logo tile:
- Remove the `p-1.5` inner padding so the logo extends edge-to-edge inside the circle.
- Add `overflow-hidden` so the square PNG is cleanly clipped by the `rounded-full` shape.
- The inner `<img>` keeps `size-full object-contain` so the mark scales to fill while staying centered and undistorted.

Result: the green mark fills the circle, with the soft `bg-slate-50` tile visible only behind the mark's transparent areas.

## Out of scope

- No regeneration of logo PNGs, no copy changes, no other card layout changes.
