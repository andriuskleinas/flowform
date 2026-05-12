## Goal

Swap the static `hero-preview.jpg` for a live, animated mock of a Flowform question card — same brand feel, but it moves. No WebGL, no extra dependencies.

## What the user will see

A glassy white form card sitting where the screenshot used to be, with:

- An auto-advancing carousel of 3 questions (text input → multi-choice → rating), cycling every ~3.5s with a soft cross-fade + subtle slide.
- A typewriter effect on each question headline.
- An animated purple progress bar that grows with each step (33% → 66% → 100%, then resets).
- A pulsing "Continue" button that subtly breathes.
- Floating ambient shards (small purple + gold rounded rects) drifting behind the card with parallax — they react to pointer position, just like the existing hero glow does.
- The existing 3D tilt-on-mousemove and aurora glow stay exactly as they are. The card replaces only the `<img>` inside `HeroPreview`.

## Scope

**Edit only** `src/routes/index.tsx`:

- Replace the `<img src={heroPreview} ... />` inside `HeroPreview` with a new `<AnimatedFormMock />` component defined in the same file.
- Remove the `heroPreview` import (asset file stays on disk, untouched, in case we want to revert).
- Keep the outer card chrome (rounded corners, shadow, tilt transform, soft-light gloss overlay) identical so the surrounding layout, aurora, and float animation are unchanged.

**Add CSS** in `src/styles.css`:

- One `@keyframes` for the typewriter caret blink.
- One `@keyframes` for the button breathing pulse.
- One `@keyframes` for the floating shards drift (slow, looped, randomised per shard via inline `animation-delay`).

No new packages. No route changes. No copy changes elsewhere.

## Out of scope

- Logo, testimonials, features, CTAs — untouched.
- Dark mode tweaks — current tokens already cover it.
- Replacing the OG/social image — `hero-preview.jpg` stays on disk.

## Technical notes

- Cycling state lives in a single `useState<number>` driven by `setInterval` inside `useEffect`, cleared on unmount.
- Typewriter is derived from the active question + a frame counter (also `useEffect` + `setInterval`, ~30ms per char), so no animation libraries needed.
- All colours via existing tokens (`bg-brand`, `text-ink`, `border-ink/5`, etc.) — no hex values in components.
- Card has a fixed aspect ratio (`aspect-[3/2]`) so the hero doesn't reflow when content swaps.
- `motion-safe:` prefix on every animation; users with `prefers-reduced-motion` see a single static question with no cycling/typewriter/pulse.

## Acceptance check

- Hero card visibly cycles through 3 questions on load.
- Pointer movement still tilts the card and shifts the aurora.
- No layout shift vs. the current static image.
- No console warnings, no new dependencies.
