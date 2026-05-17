## Root cause

The logo PNGs (`logo-northwind.png`, `logo-lumen.png`, `logo-axiom.png`) have **opaque white backgrounds** with purple marks. The current filter `brightness(0) … hue-rotate(217deg)` collapses every opaque pixel (including the white background) to brand blue, producing a solid blue square instead of a visible logo.

## Fix

In `src/routes/index.tsx`, change the testimonial logo block (lines 317–331):

1. **Remove the white wrapper `<span>`** — the source already has a white background, so no extra container is needed.
2. **Drop the white background via `mix-blend-multiply`** — on the white testimonial card, the logo's white pixels disappear and only the colored mark remains.
3. **Shift purple → brand blue** using `hue-rotate` + `saturate`, without `brightness(0)`, so internal logo detail is preserved.

```tsx
<img
  src={t.logo}
  alt={`${t.company} logo`}
  width={32}
  height={32}
  loading="lazy"
  className="size-8 object-contain mix-blend-multiply"
  style={{ filter: "hue-rotate(-35deg) saturate(1.6) brightness(0.95)" }}
/>
```

- `mix-blend-multiply` drops the white background against the white card.
- `hue-rotate(-35deg)` shifts the purple (~270°) toward blue (~235°, close to #0066FF).
- `saturate(1.6)` deepens the blue; `brightness(0.95)` keeps it from looking washed out.

## Out of scope

- No changes to the source PNG assets.
- No changes to other components, layout, or spacing.