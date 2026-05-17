## Goal

Make each testimonial logo render as a visible white square with the logo mark in brand blue (#0066FF) inside.

## Change

In `src/routes/index.tsx`, wrap the `<img>` at lines 317–328 in a white rounded square container, and keep the blue filter on the image itself.

```tsx
<span className="flex size-10 items-center justify-center rounded-lg bg-white p-1.5 ring-1 ring-ink/10">
  <img
    src={t.logo}
    alt={`${t.company} logo`}
    width={28}
    height={28}
    loading="lazy"
    className="size-7 object-contain"
    style={{
      filter:
        "brightness(0) saturate(100%) invert(28%) sepia(98%) saturate(3500%) hue-rotate(217deg) brightness(101%) contrast(106%)",
    }}
  />
</span>
```

- White square: `bg-white`, `rounded-lg`, subtle `ring-1 ring-ink/10` border so it's visible on the white card.
- Logo inside stays tinted #0066FF via the existing filter chain.
- Slightly larger (size-10 with size-7 logo + padding) so the square reads as a defined shape.

## Out of scope

No other layout, spacing, or color changes.