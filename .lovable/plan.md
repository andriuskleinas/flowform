## Goal

Tint the three company logos in the testimonials carousel (Northwind, Lumen, Axiom) so they visually match the primary brand blue (#0066FF), without touching the source PNG files.

## Change

In `src/routes/index.tsx`, inside `TestimonialsCarousel`, add a CSS filter to the `<img>` tag at lines 317–324 that recolors any opaque pixels to the brand blue:

```tsx
<img
  src={t.logo}
  alt={`${t.company} logo`}
  width={32}
  height={32}
  loading="lazy"
  className="size-8 object-contain"
  style={{
    filter:
      "brightness(0) saturate(100%) invert(28%) sepia(98%) saturate(3500%) hue-rotate(217deg) brightness(101%) contrast(106%)",
  }}
/>
```

The `brightness(0)` collapses each logo to a solid silhouette, then the chained `invert/sepia/saturate/hue-rotate` filters retint it to #0066FF. Works on any PNG with a transparent background regardless of its original color.

## Out of scope

- No changes to functionality, layout, spacing, or other components.
- No edits to the source logo assets.
- No design token changes — `--brand` already equals #0066FF.