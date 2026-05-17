## Goal
Rebrand the app's color system to:
- **Primary** (Create Form, Save, main CTAs): purple `#9151B8`
- **Secondary** (Cancel, secondary actions): pink `#FF57B0`
- **Text**: golden yellow `#EEB72B`
- **Backgrounds**: light gray

## Approach — token-only change in `src/styles.css`

All buttons and text already consume semantic tokens (`--primary`, `--secondary`, `--foreground`, `--background`, `--brand`, `--ink`, `--surface`). I'll change the token values; no component code needs to change.

### Token updates (light theme, `:root`)
- `--primary: oklch(...)` → purple `#9151B8`
- `--primary-foreground: oklch(0.99 0 0)` → white (kept, for legibility on purple)
- `--secondary` → pink `#FF57B0`
- `--secondary-foreground` → white
- `--brand` → purple `#9151B8` (so the home page accents match)
- `--ring`, `--accent-foreground` → purple
- `--accent` → soft purple tint
- `--background` / `--surface` → light gray (`oklch(0.96 0 0)`)
- `--foreground` / `--ink` / `--card-foreground` / `--popover-foreground` / `--secondary-foreground` (where used as text) → golden yellow `#EEB72B`
- `--muted-foreground` → softer golden yellow
- `--border`, `--input` → mid gray
- `--gold` → keep (already yellow, used as accent on home page)

### Dark theme (`.dark`)
- Mirror the same hues with adjusted lightness so purple/pink/yellow stay legible on dark.

## ⚠️ Readability warning
Golden yellow text (`#EEB72B`) on light gray backgrounds fails WCAG contrast (~1.6:1; AA needs 4.5:1). It will be hard to read body copy, form labels, table data, etc. Two options:

**A. Do exactly as requested** — apply yellow text on light gray everywhere. Accept the low contrast.

**B. Compromise (recommended)** — use golden yellow only for headings/accents/links and keep a dark ink color for body text on light gray, so the app stays readable while still feeling "golden."

I'll proceed with **option A** as requested unless you tell me otherwise after seeing it — easy to switch to B with one token tweak.

## Out of scope
- No component refactors, no new files.
- Home page hero gradient and bento accents will automatically shift to the new palette via tokens.