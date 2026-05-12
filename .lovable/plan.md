## Goal

Remove the brand logo bar from the social proof section in `src/routes/index.tsx`. Keep the three testimonial cards intact.

## Changes

- Delete the eyebrow label "Trusted by teams shipping serious work" and the wrapper div containing the 5 typographic logos (NORTHWIND, LUMEN, AXIOM, FIELDNOTES, KORU).
- Remove the now-unused `logos` constant.
- Remove the `mt-16 md:mt-20` top margin from the testimonials `<ul>` since it no longer needs to space away from the logo bar — testimonials become the section's first content.

## Out of scope

- No changes to testimonials, hero, features, closing CTA, footer, or design tokens.
