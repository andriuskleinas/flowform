## Goal

Replace the placeholder home page with a polished landing page for a Typeform-style form builder ("Flowform"), using the **Modern Minimalist** direction. No other pages, no auth, no database.

## Scope

- Single route: `src/routes/index.tsx` (homepage only)
- Add design tokens to `src/styles.css` (brand green, surface, ink) using `oklch`
- Generate one hero product preview image to `src/assets/`
- Update SEO metadata (title, description, og tags) in `src/routes/__root.tsx`

## Page sections

1. **Nav** — Flowform logo mark + minimal links (Features, Pricing as anchors) + a primary CTA button
2. **Hero** — Big headline "Forms that feel like a conversation.", subhead, single primary CTA "Create your first form", and a hero product preview image with soft brand glow
3. **Features (3-up grid)** — Step-by-step logic / Beautiful themes / Deep analytics, each with an icon tile and short copy
4. **Closing CTA** — Dark rounded card with headline, subhead, and the same primary CTA
5. **Footer** — Copyright + minimal links

## CTA behavior

All primary CTAs route to `/` with a `data-cta="demo"` attribute and a no-op `onClick` placeholder, so they're trivially wired to a real demo form later.

## Design system

Add tokens in `src/styles.css` (oklch equivalents of #059669 brand, #FAFAFA surface, #0F172A ink) and register them in `@theme inline` as `--color-brand`, `--color-surface`, `--color-ink`. Use Plus Jakarta Sans via Google Fonts link in `__root.tsx` head. All component classes use semantic tokens (`bg-surface`, `text-ink`, `bg-brand`) — no hardcoded hex.

## Image

Generate one image with `imagegen--generate_image` (fast tier, 1600x1000, jpg) for the hero product preview, save to `src/assets/hero-preview.jpg`, import as ES6.

## Out of scope

No additional routes, no Lovable Cloud, no forms logic, no testimonials/logo bar, no pricing section.
