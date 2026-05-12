## Goal

Turn the static brand glow behind the hero preview into a living aurora — a slow, premium light show that feels alive without distracting from the product image.

## What you'll see

Three layered light sources behind the preview card, each on its own independent timeline:

1. **Primary brand orb** — large soft `bg-brand/30` blurred blob, slowly drifts in a figure-8 pattern over ~14s and gently breathes (scale 1 → 1.1 → 1) over ~10s.
2. **Secondary cool orb** — smaller `bg-emerald-300/25` blob drifting on a different ~18s loop in the opposite direction, slightly offset.
3. **Pulse halo** — a thin outer ring that fades opacity 0.4 → 0.8 → 0.4 on a ~6s loop for a heartbeat feel.

On hover, all three intensify (existing `--glow` var already in place from the tilt component) and the drift speeds up slightly via a CSS class swap. The whole stack respects `prefers-reduced-motion`.

## Implementation

- Replace the single glow `<div>` inside `HeroPreview` (in `src/routes/index.tsx`) with a stacked container holding three absolutely-positioned blurred divs, each with `motion-safe:animate-[name_duration_ease_infinite]`.
- Add three new keyframes to `src/styles.css`: `aurora-drift-a`, `aurora-drift-b`, `aurora-pulse`. Each translates and scales — pure GPU transform, no layout cost.
- Keep the wrapper sized via the existing `-inset-6 rounded-[40px]` so positioning is unchanged.
- Each orb uses `will-change: transform` and `mix-blend-mode: screen` so they layer like light, not paint.
- Glow intensity still keys off `--glow` (set by the existing pointer handler) for hover boost.

## Out of scope

- No new dependencies (no Framer Motion, no canvas).
- No changes to hero copy, image, layout, or other sections.
- No change to the existing tilt + float + spotlight motion on the card itself — this only enhances the glow behind it.
