## Closing CTA — refresh

Fix the final "Ask sharper. Learn faster." block so it matches the rest of the home page in width, rhythm, and visual weight.

### Issues today
- Card is `max-w-5xl` while every other section uses `max-w-7xl` → looks narrow and floats awkwardly.
- A single off-center blue glow in the top-right unbalances the card.
- Stacking (headline → subcopy → button → microcopy) is loose; nothing reinforces trust.
- No supporting proof points, so the block feels lighter than the sections above it.

### Changes (frontend only, `src/routes/index.tsx`, CTA section ~516–538)

1. **Match page width** — bump the card wrapper from `max-w-5xl` to `max-w-7xl` so its edges align with the features grid and header.
2. **Solid, balanced background** — keep the dark ink card, but replace the single off-center glow with a symmetric pair (soft brand glow top-left and top-right) plus a subtle 1px inner border (`ring-1 ring-white/10`) for a more crafted, premium feel.
3. **Tighten the stack** — center column capped at `max-w-2xl`, consistent vertical rhythm (headline → 6 subcopy → 10 CTA), keep the existing `PrimaryCTA`.
4. **Add a trust row** under the CTA — a thin divider then a single horizontal row with three muted items separated by dots:
   - "Free forever · No card required"
   - "SOC 2 ready"
   - "GDPR compliant"
   Rendered in `text-xs uppercase tracking-[0.2em] text-white/40` so it reads as quiet reassurance, not noise. No new assets, no new dependencies.
5. **Padding** — increase to `p-12 md:p-20` so the larger card still breathes.

No changes to copy of the headline/subhead, no business logic, no other sections, no new files.
