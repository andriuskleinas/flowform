## Goal

Convert the testimonials section into a single-card carousel and bring back the company logo on each testimonial card.

## Carousel

- Use the existing shadcn `Carousel` component (`src/components/ui/carousel.tsx`, built on `embla-carousel-react`) — already in the project, no new dependencies.
- Show **one testimonial per slide on mobile, two on tablet, three on desktop** via the standard `basis-full md:basis-1/2 lg:basis-1/3` pattern. This keeps the section feeling generous while letting the user swipe/click through.
- Add `<CarouselPrevious />` and `<CarouselNext />` arrows positioned just outside the slide track on desktop, hidden on small screens (touch users get native drag).
- Add slim dot pagination beneath the track that reflects the active slide. Dots are clickable.
- Enable `loop: true` and `align: "start"` on the Carousel `opts`. Optional: an autoplay tick every ~6s using a tiny `useEffect` that calls `api.scrollNext()` and pauses on hover (no autoplay plugin needed).
- Section background and card styles stay exactly as they are.

## Logos on each testimonial

- Re-import the existing `src/assets/logo-northwind.png`, `logo-lumen.png`, `logo-axiom.png`.
- Add `logo` and `company` back to each entry of the `testimonials` array.
- Render the logo as a small **wordmark-style row at the top of each card**: a 32px-tall logo image followed by the company name in tracked uppercase text, separated by a thin divider beneath the row. This avoids the previous round-tile awkwardness — logos sit clean at the top, name + role stay below the quote.

## Card layout (per slide)

```
[ logo + company name ]
────────────────────────
"Quote text..."
[ name ]
[ role ]
```

- Min-height on the quote stays so cards align across slides.

## Out of scope

- No new sections, no new dependencies, no carousel autoplay plugin (manual interval if we want autoplay), no testimonial copy changes, no design-token changes.
