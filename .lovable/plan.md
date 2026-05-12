## Goal

Make the entire hero **section** react to the cursor — not just the preview card. The whole space feels alive: light follows the pointer, the headline drifts subtly with parallax, and the preview's tilt + spotlight responds even when the cursor is far from the card.

## What you'll see

1. **Section-wide cursor spotlight** — a large soft radial glow (tinted brand-green) tracks the cursor across the full hero. It sits behind everything and bleeds through the existing aurora. Fades in on enter, fades out on leave.
2. **Headline + subhead parallax** — the H1 and subhead shift ~6–10px opposite to cursor position (cursor right → text drifts left), giving a subtle 3D depth read between text and image.
3. **Preview tilt extends to section** — the existing card tilt + spotlight now key off the **section-wide** cursor position (normalized to the card's own bounds), so moving the mouse anywhere in the hero already nudges the preview. The card's local hover still amplifies the effect.
4. **CTA gleam follow** — the primary CTA gets a faint angled gleam that follows the cursor X position when it's near.

## Implementation in `src/routes/index.tsx`

- Wrap the hero `<section>` with a single `onPointerMove` / `onPointerLeave` handler that writes four CSS custom properties on the section element: `--sx`, `--sy` (0–1 normalized cursor position), `--px`, `--py` (px from center for parallax), and `--active` (0 or 1 for fade).
- Move that logic into a small `HeroSection` component so the route stays clean.
- The current `HeroPreview` component reads the same vars from its closest section ancestor via `var(--sx, 0.5)` etc., replacing its own local pointer handler. (One pointer source, multiple consumers.)
- Add a fixed-position-but-section-bound layer at the top of the section: `<div className="absolute inset-0 pointer-events-none">` containing a radial-gradient div whose `background-position` uses `calc(var(--sx, 0.5) * 100%) calc(var(--sy, 0.5) * 100%)` and `opacity: var(--active, 0)`.
- Headline + subhead get inline `transform: translate3d(calc(var(--px,0) * -0.04px), calc(var(--py,0) * -0.04px), 0)` plus `transition: transform 200ms ease-out` for smoothing.
- All motion behind `motion-safe:` — reduced-motion users see static hero.

## Out of scope

- No new dependencies (still pure CSS vars + one pointer handler).
- No layout, copy, or color-token changes.
- No changes to nav, features, testimonials, CTA section, or footer.
- The existing aurora/float/entrance animations stay; this layers on top.
