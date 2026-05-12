## Goal

Fix two visual issues on the testimonial cards in `src/routes/index.tsx`:
1. Author rows (logo + name + role) are vertically misaligned across the three cards because quotes have different lengths and roles wrap to a second line at the current viewport.
2. The logo marks look too small inside their rounded tile.

## Changes

In `src/routes/index.tsx`, on the testimonial card markup only:

- **Bigger logo tile**: change avatar wrapper from `size-10 ... p-1.5` to `size-12 shrink-0 ... p-2` and switch the inner `<img>` to fill the tile cleanly. Result: logo mark visually fills the tile instead of floating tiny in the middle.
- **Align author rows across cards**: give the quote `<p>` a `min-h-[7rem] md:min-h-[8rem]` so all three quotes occupy the same vertical space; the author block then starts at the same Y position on each card. Keep the existing card `flex-col` layout but drop `justify-between` (no longer needed once quote has a min-height) so the author row sits directly below the quote with the existing `mt-8` spacing.

## Out of scope

- No copy changes, no new design tokens, no card border/shadow changes, no logo regeneration, no responsive breakpoint changes beyond the min-height tweak.
