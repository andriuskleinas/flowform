## What feels off today

- The closing CTA uses `pt-24` only, then relies on the inner `p-12 md:p-20` for bottom space — so the dark block's vertical rhythm doesn't match the other sections, which all use a symmetric `py-24 md:py-32`.
- The inner content sits in a `max-w-7xl` wrapper but the actual text column is `max-w-2xl`, so the two glow circles are pinned to the far top corners of a very wide invisible box and feel disconnected from the headline.
- The footer is a single centered `© Flowform` line with `py-10` — it reads as an afterthought against a full-width dark slab, with no brand mark, no visual weight, and no relationship to the nav at the top.

## Plan

1. **Closing CTA section** (`src/routes/index.tsx`, lines 515–544)
   - Match the page's section rhythm: `bg-ink px-6 py-24 md:px-8 md:py-32` (symmetric padding, no inner card padding doubling up).
   - Drop the `p-12 md:p-20` inner padding. Use `relative mx-auto max-w-3xl text-center text-white` so the glow circles, headline, subcopy, CTA, and "Free forever" caption form one tight, centered column — same feel as the hero.
   - Re-center the two `bg-brand/25 blur-[120px]` glows behind the headline (one slightly left, one slightly right) instead of pinned to far corners of an empty 7xl box, so they actually halo the CTA.
   - Tighten type scale to mirror the hero/features rhythm (`text-4xl md:text-6xl` headline, `text-lg md:text-xl` subcopy).

2. **Footer** (lines 547–551)
   - Keep `bg-ink` so it remains visually continuous with the CTA.
   - Add a thin `border-t border-white/5` divider so the footer reads as its own band without breaking the dark color.
   - Restructure into a `max-w-7xl` row mirroring the top nav: left side shows the Flowform logo mark + wordmark (same lockup as the header, white tint), right side shows `© {year} Flowform`. Stack vertically on mobile.
   - Keep Privacy/Terms removed per the prior decision.

3. No changes to colors, tokens, copy wording, or any other section.

## Technical notes

- All edits stay inside `src/routes/index.tsx`. Reuse the existing logo lockup markup from the header (`<span className="flex size-8 ... bg-brand">`), swapping the wordmark color to `text-white` for the footer.
- No new components, no new dependencies, no token changes in `src/styles.css`.
