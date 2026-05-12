## Goal

Make the hero product preview image feel alive and premium with three coordinated motion layers, no new dependencies.

## What you'll see

1. **Entrance reveal** — On mount, the image card fades up with a soft scale (from `opacity-0 translate-y-6 scale-[0.98]` to neutral) over ~700ms with an ease-out curve. The brand glow behind it fades in slightly later for a layered feel.
2. **Continuous float** — The image card gently bobs up/down (~6px) on a ~6s ease-in-out infinite loop. Subtle, almost subliminal — premium, not cartoonish.
3. **Mouse-tracking 3D tilt + spotlight** — On pointer move over the card, it tilts on X/Y axes up to ~6° following the cursor (CSS `transform: perspective(1200px) rotateX() rotateY()`), with a soft radial highlight (`bg-white/30` blurred blob) following the cursor inside the card. On pointer leave, everything springs back to rest with a 400ms ease.

The brand glow behind the card slightly intensifies on hover (opacity 15% → 25%) to reinforce focus.

## Implementation in `src/routes/index.tsx`

- Extract the hero preview block (~lines 122–138) into a small inline component `HeroPreview` defined in the same file (keeps the route file self-contained, no new files).
- Use a single `useRef` on the wrapper and an `onPointerMove` / `onPointerLeave` handler that writes `--rx`, `--ry`, `--mx`, `--my` CSS custom properties on the wrapper. The transform and spotlight read those vars — zero re-renders, GPU-only.
- Use Tailwind utilities for the float (`animate-[float_6s_ease-in-out_infinite]`) and entrance (`animate-[fade-in_0.7s_ease-out_both]`). Add a `@keyframes float` block in `src/styles.css` (other keyframes like `fade-in` already exist per project animation utilities).
- Respect `prefers-reduced-motion`: wrap the float and entrance animations in `motion-safe:` variants so users who opt out get a static image.

## Design notes

- Tilt max 6° (not 15° — premium products use restraint).
- Spotlight is a 60% radius radial-gradient mask, very soft, sits above the image with `mix-blend-mode: soft-light` and ~30% opacity so it reads as light, not a sticker.
- All transitions use `transition-transform duration-300 ease-out` on tilt reset; the live cursor movement updates instantly via CSS vars.

## Out of scope

- No new npm packages (no Framer Motion, no GSAP — pure CSS + 1 pointer handler).
- No changes to copy, layout, or other sections.
- No changes to the underlying image asset.
