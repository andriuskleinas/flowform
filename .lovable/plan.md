## Goal

Add a social proof section to the Flowform landing page to reinforce premium credibility, placed between the Hero and Features sections in `src/routes/index.tsx`.

## Section structure

1. **Logo bar** — A single row of 5 fictional brand wordmarks rendered as styled text (e.g. NORTHWIND, LUMEN, AXIOM, FIELDNOTES, KORU) in uppercase, tracked-out, `text-ink/40`, with a small eyebrow label above: "Trusted by teams shipping serious work."
2. **Testimonials** — A 3-up grid of short quotes (1–2 sentences each), each card containing:
   - Quote text in `text-ink/80`, slightly larger than body
   - Author block: small circular avatar (initials on a `bg-brand/10` tile, no external image), name, role @ company
   - Subtle `border border-ink/5` card on white, rounded-2xl, generous padding
   - On mobile: stack to a single column

## Copy (premium, punchy — matches existing tone)

- "We replaced three survey tools with one Flowform. Response rates doubled in a week." — Maya Chen, Head of Research @ Northwind
- "It finally looks like our brand. Customers actually finish the form." — Daniel Ortiz, Design Lead @ Lumen
- "The drop-off insights are surgical. We rewrote our onboarding in an afternoon." — Priya Raman, Growth @ Axiom

## Design

- Section background: `bg-surface` (matches hero) so the white Features section still pops below
- Reuse existing tokens only: `bg-brand`, `text-ink`, `text-brand`, `border-ink/5`, `bg-white`
- No new images, no new dependencies, no new design tokens
- Logos are typographic (no SVG assets needed) to keep it premium and zero-cost

## Out of scope

- No new routes, no carousel, no real customer logos/images, no ratings widget, no CMS, no Cloud
- No changes to nav, hero, features, closing CTA, or footer beyond the new section insertion
