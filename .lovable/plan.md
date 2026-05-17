## Goal
Refresh the `#features` section in `src/routes/index.tsx` so it feels premium and blends into the rest of the home page (white surface, brand blue, soft gold ambient orbs already used by Testimonials below). Based on the selected "Glass ambient bento" direction, with two adjustments per your feedback:
- Make it feel authentic, not template-y.
- Drop the "Smart flows / Premium styling / Live analytics" link rows (they don't go anywhere).

## Changes — `src/routes/index.tsx` only

### 1. Headline
- Split the heading into two lines and color the second line `text-brand`:
  - Line 1: `Built for the questions`
  - Line 2 (brand blue): `that matter.`
- Keep existing typography scale (`text-3xl md:text-5xl font-extrabold`), tighten leading slightly.

### 2. Section background
- Keep `bg-white` but add two ambient blur orbs (matching Testimonials' visual language so the two sections feel like one world):
  - `bg-brand/5` orb top-left
  - `bg-gold/5` orb bottom-right
- Section gets `relative overflow-hidden`; orbs are `pointer-events-none`, `aria-hidden`.

### 3. Cards (3-up bento, equal columns)
Replace the flat `<ul>` with three rounded-`[28px]` white cards:
- `border border-brand/10` (gold variant on the middle "Design" card: `border-gold/15`).
- Soft resting shadow, hover lifts (`-translate-y-1`) and deepens shadow tinted with the card's accent color.
- Icon tile: `size-14 rounded-2xl bg-brand/10 text-brand` (middle card uses gold tokens). Hover scales icon `1.1`.
- Behind the icon, an opacity-0 → opacity-100 ambient glow blob on hover (`bg-brand/10 blur-2xl`, gold for middle).
- Title `text-2xl font-bold`, body `text-ink/60 leading-relaxed text-base md:text-lg`.
- No CTA / link row at the bottom — per your note, those go nowhere.
- Replace bottom link row with a thin top accent bar that appears on hover: `h-px w-12 bg-brand/40` (gold for middle) — subtle authenticity touch, no fake CTA.

### 4. Tokens
- Use existing semantic tokens (`brand`, `gold`, `ink`, `surface`) from `src/styles.css`. No hardcoded hex.
- Middle card's gold accent ties visually to the gold orb in Testimonials.

### 5. Data model
- Keep the `features` array as-is (icon, title, body). Add an optional `accent: 'brand' | 'gold'` field; default `brand`, set `gold` on the "Design that owns the room." item. Use it to pick token classes inside the map.

### Out of scope
- No content/copy changes beyond the headline line-break.
- No changes to Hero, Testimonials, CTA, or nav.
- No new files, no new dependencies.