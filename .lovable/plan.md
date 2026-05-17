## Closing CTA + footer cleanup

Edits in `src/routes/index.tsx` only.

### CTA trust row (~540–548)
- Remove the `<ul>` with SOC 2 / GDPR items and the surrounding `border-t` divider.
- Replace with a single line under the button: `Free forever · No card required` in white (`text-white/90`), same uppercase tracking style.

### Connect CTA to footer
- Remove the bottom padding from the CTA section (`py-24 md:py-32` → `pt-24 md:pt-32`, no bottom pad) and drop the card's outer rounded corners on the bottom so it visually flows into the footer. Simpler approach: keep the card as-is but make the footer `bg-ink text-white/60` and remove the section's bottom padding so the dark footer sits flush beneath the dark card.
- Footer: change `border-t border-ink/5` → `bg-ink`, text color to `text-white/40`, link hover to `hover:text-white`.

### Footer links
- Remove the Privacy and Terms links. Keep only the `© 2026 Flowform` copyright, centered.

No other sections, no logic changes, no new files.
