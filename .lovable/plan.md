## Goal
Remove the hard edges between home sections so backgrounds blend continuously from hero → features → testimonials → final CTA.

## Current state
- Wrapper: `bg-surface` (light blue tint)
- Hero: transparent (inherits surface)
- Features: `bg-white` + `border-y border-ink/5` — creates a visible hard line
- Testimonials: `bg-gradient-to-b from-surface via-white to-surface`
- Dark CTA: `bg-ink` (intentional hard contrast, keep as-is)

## Changes — `src/routes/index.tsx` only

1. **Hero section** — add `bg-gradient-to-b from-surface via-surface to-white` so it eases into Features' white.

2. **Features section** — remove `border-y border-ink/5`. Keep `bg-white` but make it `bg-gradient-to-b from-white via-white to-surface` so the bottom fades into Testimonials' surface tone.

3. **Testimonials section** — change gradient to `bg-gradient-to-b from-surface via-white to-surface` → keep, but ensure the top starts at `surface` (matches Features' new bottom) and bottom ends at `surface` (clean handoff to the dark CTA).

4. **Dark CTA boundary** — add a thin transition: wrap the dark CTA section in nothing extra, but on the Testimonials section let the bottom go to a slightly darker surface so the jump to `bg-ink` feels intentional rather than abrupt. Implementation: add a 1px-tall gradient divider (`h-24 bg-gradient-to-b from-surface to-ink`) just before the CTA section as a visual easing band.

5. Remove any leftover `border-y` / `border-t` between affected sections.

## Out of scope
- No copy or layout changes inside any section.
- No token/color changes in `styles.css`.
- Dark CTA section keeps its dark theme intent.