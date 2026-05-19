## Reduce easing band visibility for sleeker transition

### Problem

The gradient band at line 657 (`h-24 bg-gradient-to-b from-surface to-ink`) is 96px tall, creating a highly visible fade strip between the light testimonials section and the dark closing CTA. This looks heavy, not sleek.

### Fix

Reduce the band height from `h-24` to `h-8` (32px). This keeps a subtle anti-aliased edge between the two contrasting sections without drawing attention to the transition itself.

### File

- `src/routes/index.tsx` — line 657

No other changes needed.
