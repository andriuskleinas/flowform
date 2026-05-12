## Goal
Replace the green brand color across the site with a **purple** primary brand and a **yellow-golden** secondary accent. No layout, copy, or animation changes.

## Changes

### 1. `src/styles.css` — swap brand tokens, add gold accent
- `--brand` (currently green `oklch(0.6 0.13 160)`) → purple `oklch(0.55 0.22 295)`
- `--brand-foreground` stays near-white
- Add new tokens:
  - `--gold: oklch(0.82 0.16 90)` (warm yellow-golden)
  - `--gold-foreground: oklch(0.2 0.04 90)`
- Register both in the `@theme inline` block so Tailwind utilities `bg-gold`, `text-gold`, `bg-brand`, etc. work.
- Mirror token values in `.dark` if needed (slightly lighter purple for contrast).

### 2. `src/routes/index.tsx` — replace remaining green
- Line 67: `bg-emerald-300/40` (aurora blob in HeroPreview) → `bg-gold/40`
- Any other green-flavored utility classes spotted during the edit pass get swapped to `bg-brand` (purple) or `bg-gold` (yellow) based on which reads better contextually (e.g., secondary aurora/glow → gold; primary surfaces, dots, CTAs → purple).

### 3. Verification
- Grep for `green|emerald|lime|teal` in `src/` after edits to confirm none remain.
- Visually check hero, feature icons, CTA buttons, testimonial dots, footer mark.

## Out of scope
- No changes to typography, spacing, animations, or component structure.
- No changes to chart colors or destructive/semantic tokens unrelated to brand.
