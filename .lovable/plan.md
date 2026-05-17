
# Design Polish Plan

Three focused, visual-only improvements. No features, routes, or logic touched.

## 1. Typography — Stronger hierarchy

Update `src/styles.css` and page components to introduce a clear scale.

- Add base type styles in `@layer base`:
  - `h1`: `text-4xl md:text-5xl font-bold tracking-tight` (was inconsistent)
  - `h2`: `text-2xl md:text-3xl font-semibold tracking-tight`
  - `h3`: `text-xl font-semibold`
  - body: keep `text-base`, muted captions `text-sm text-muted-foreground`
- Sweep heading usage in:
  - `src/routes/index.tsx` (landing)
  - `src/routes/dashboard.tsx`
  - `src/routes/forms.$formId.index.tsx`
  - `src/routes/forms.$formId.responses.tsx`
  - `src/routes/forms.$formId.edit.tsx`
  - `src/routes/login.tsx`, `signup.tsx`
- Standardize `CardTitle` to `text-lg font-semibold` and section titles to `text-2xl font-semibold`.

## 2. Color — Primary / Secondary / Neutral system

Refine tokens in `src/styles.css` (light + dark) so buttons and surfaces read clearly.

- **Primary** (CTA, key actions): use existing `--brand` (violet `oklch(0.55 0.22 295)`) as the primary button color. Remap `--primary` to brand so `<Button variant="default">` becomes the real CTA.
- **Secondary** (supporting actions): keep `--secondary` as a soft neutral; ensure `<Button variant="secondary">` reads as a calm alternate (light slate / dark slate).
- **Neutral palette** for backgrounds:
  - `--background`: page surface (off-white / deep ink)
  - `--surface`: cards / panels (already defined — wire `--card` to it in light mode)
  - `--muted`: subtle fills (inputs, hover)
  - `--border`: hairline dividers
- Ensure contrast: `--primary-foreground` stays near-white against violet.

No component code needs new color classes — just retune tokens so existing `bg-primary`, `bg-secondary`, `bg-card`, `bg-muted` look intentional.

## 3. Spacing — Consistent 8 / 16 rhythm

Apply an 8px base rhythm: **8px between related elements, 16px between sections**, with larger multiples (24/32/48) for page-level breathing room.

- Page wrappers: `container mx-auto px-6 py-8 md:py-12 space-y-8` (16–32px between sections)
- Cards: keep `CardHeader p-6`, ensure `CardContent` uses `space-y-4` for related items (16px) and inner clusters `space-y-2` (8px)
- Form rows: label + input use `space-y-2`; field groups use `space-y-4`; form sections use `space-y-6`
- Button groups: `gap-2` for tight pairs, `gap-4` between distinct action clusters
- Sweep the same five route files as above to apply this consistently. Remove ad-hoc margins (`mt-3`, `mb-5`, etc.) in favor of parent `space-y-*`.

## Technical notes

- All color changes happen in `src/styles.css` token blocks (`:root` and `.dark`) — no component-level color hex.
- Typography base styles added under `@layer base` so existing `<h1>`/`<h2>` tags pick them up automatically; per-page overrides only where a hero needs a bump.
- Spacing changes are Tailwind class edits on existing JSX — no structural changes.
- Zero changes to: routes, server functions, Supabase schema, auth, form rendering logic, analytics page behavior.

## Verification

- Visit `/`, `/dashboard`, a form edit page, and the responses/analytics page; confirm headings have stronger hierarchy, primary buttons are violet, secondary buttons are neutral, and spacing feels even at the 8/16 rhythm.
