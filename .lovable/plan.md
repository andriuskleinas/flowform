# Reorder + Redesign Testimonials

## 1. Reorder sections in `src/routes/index.tsx`
Current order: Hero → Testimonials → Features → Closing CTA.
New order: Hero → Features → **Testimonials** → Closing CTA.

Move the `<section>` containing `<TestimonialsCarousel />` so it renders directly after the `#features` section and before the dark "Ask sharper. Learn faster." CTA. No content change to other sections.

## 2. Add a proper section header
Match the page's existing eyebrow + headline + subhead pattern (same typography scale used by the Features section):

- Eyebrow chip: `Testimonials` — uppercase, tracked, `text-brand`, small pill with `bg-brand/10`
- H2: `Loved by teams who ask better questions.` — `text-3xl md:text-5xl font-extrabold tracking-tight`
- Subhead: short single sentence in `text-ink/60`

## 3. Redesign the testimonial cards (impress factor)
Keep `TestimonialsCarousel` logic (embla, autoplay, dots, prev/next) but upgrade the visual treatment:

- **Section background**: soft brand-tinted gradient band (`bg-gradient-to-b from-surface via-white to-surface`) with two large blurred brand/gold orbs as ambient backdrop (same vocabulary as hero aurora) so the section reads as a hero-grade moment, not a filler strip.
- **Card style**:
  - Larger, taller cards with generous padding (`p-10`), `rounded-3xl`, subtle border + layered shadow (`shadow-xl shadow-brand/5`)
  - Oversized opening quote glyph (`"`) in `text-brand/15`, absolutely positioned top-left as a watermark
  - Quote text bumped to `text-xl md:text-2xl leading-snug font-medium text-ink` (the star of the card, not muted)
  - 5-star row in `text-gold` above the quote
  - Footer row: circular avatar with initials on a `bg-brand/10 text-brand` chip + name (bold) + role · company (muted) on one line
  - Active/center card gets a soft scale + ring (`ring-1 ring-brand/20`) so the carousel has a clear focal slide
- **Hover**: card lifts (`-translate-y-1`), shadow deepens, quote glyph fades in slightly — all `transition-all duration-300`
- **Controls**: keep prev/next arrows but restyle to match brand (circular, `bg-white shadow-md hover:bg-brand hover:text-brand-foreground`); keep the existing dot indicator row

## 4. Tokens & consistency
All colors via existing tokens (`brand`, `brand-foreground`, `gold`, `ink`, `surface`) — no raw hex. Reuse the typography scale already used by Features so the section feels native to the page.

## Files touched
- `src/routes/index.tsx` (reorder section, restyle `TestimonialsCarousel` + section wrapper)

No data, no routing, no backend changes.
