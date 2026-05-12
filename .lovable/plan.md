## Goal

Make the three testimonial logos appear visually consistent and ensure the logo row aligns horizontally across all cards.

## Issues

1. The generated PNGs have different internal padding around the mark (the compass fills its canvas, the triangle has lots of empty space), so even though the tiles are the same size the logos look different sizes.
2. When the role text wraps to two lines on one card and one line on another, the logo (centered against that text block) shifts up or down — breaking horizontal alignment across the three cards.

## Changes

### 1. Normalize the logo PNGs

Re-render each logo with `imagegen--edit_image` to remove inner whitespace so the mark fills the frame edge-to-edge with a small consistent padding. Targets stay at the same paths:
- `src/assets/logo-northwind.png`
- `src/assets/logo-lumen.png`
- `src/assets/logo-axiom.png`

Prompt for each: "crop and rescale so the green mark fills ~85% of the square frame, perfectly centered, identical visual weight across the set, transparent background, no text".

### 2. Lock logo row alignment in `src/routes/index.tsx`

On the author block:
- Change `items-center` to `items-start` so the logo tile anchors to the top of the author block. With the existing quote `min-h`, all three logos then sit on the same horizontal line regardless of whether the role wraps to one or two lines.
- Bump tile inner padding from `p-2` to `p-1.5` so the (now tightly-cropped) logos have consistent breathing room without floating in space.

## Out of scope

- No copy changes, no card border/shadow changes, no new assets beyond re-rendering the existing three logos, no new design tokens.
