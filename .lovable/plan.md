
# Color System Update

Retune the color tokens in `src/styles.css` to use a professional blue and neutral grays. No component code changes — all updates flow through CSS custom properties.

## Changes to `src/styles.css` (`:root` block)

| Token | New value | Used for |
|---|---|---|
| `--brand` | `oklch(0.58 0.21 256)` (≈ #0066FF) | Primary buttons (Create Form, Save, Submit, CTAs) |
| `--brand-foreground` | `oklch(0.99 0 0)` (white) | Text on primary buttons |
| `--primary` | same blue as `--brand` | shadcn `Button` default variant |
| `--primary-foreground` | white | Text on primary |
| `--secondary` | `oklch(0.94 0.003 260)` (light gray) | Secondary buttons (Cancel, back actions) |
| `--secondary-foreground` | `oklch(0.25 0.01 260)` (dark gray) | Text on secondary |
| `--muted` | `oklch(0.96 0.003 260)` (lighter gray) | Subtle fills, input bg |
| `--muted-foreground` | `oklch(0.45 0.01 260)` (mid gray) | Secondary text |
| `--background` | `oklch(0.985 0.002 260)` (light gray) | Page background |
| `--surface` | same as background | Section surface |
| `--ink` | `oklch(0.22 0.01 260)` (dark gray) | All body text |
| `--foreground` | matches `--ink` | Default text color |
| `--border` | `oklch(0.91 0.005 260)` | Hairlines, dividers |
| `--ring` | matches `--brand` | Focus ring |
| `--accent` | `oklch(0.95 0.04 256)` (pale blue tint) | Hover/highlight tint |
| `--accent-foreground` | blue (`--brand`) | Text on accent |

Dark mode (`.dark` block) is left untouched — these changes only affect the default light theme the app actually ships with.

## What stays the same

- No component files are edited. Existing classes (`bg-brand`, `bg-primary`, `bg-secondary`, `text-ink`, `bg-surface`, `border-ink/5`, etc.) automatically pick up the new colors.
- Typography scale, spacing, radius, animations untouched.
- No functionality, routes, or business logic changed.

## Verification

After save, check `/`, `/dashboard`, `/forms/new`, and a form edit page to confirm:
- Primary CTAs render in professional blue
- "Cancel" / secondary buttons render in light gray with dark text
- Page backgrounds are light gray, body text is dark gray
- Focus rings on inputs match the new blue
