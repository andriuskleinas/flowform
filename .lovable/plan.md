# Dashboard + Forms Database

## Goal
Make the form builder functional: a `/dashboard` page where anyone can create a form (title + optional description) and see all saved forms, newest first. Add navigation from the landing page.

## Backend (Lovable Cloud)
Enable Lovable Cloud and create one table:

`forms`
- `id` uuid pk default `gen_random_uuid()`
- `title` text not null
- `description` text nullable
- `created_at` timestamptz default `now()`

RLS: enabled, with permissive policies for now (anyone can SELECT and INSERT) since there is no auth yet. No UPDATE/DELETE policies — read/create only. A note will go in the security memory so the scanner doesn't flag the public-write policy as an oversight.

## New route: `src/routes/dashboard.tsx`
- Own `head()` metadata (title "Dashboard — Flowform", matching description, og tags).
- Visible H1: "Your forms".
- Form card at top with:
  - Title input (required, max 120 chars)
  - Description textarea (optional, max 500 chars)
  - "Save form" button (disabled while submitting / when title empty)
- Below it, a list of all forms ordered by `created_at desc`, showing title, description, and a relative timestamp. Empty state: "No forms yet — create your first one above."
- Uses TanStack Query for fetching/invalidating the list. Data access via the browser Supabase client (`@/integrations/supabase/client`) since the table is intentionally public for now — no server function needed.
- Layout/styling matches the landing page: `bg-surface`, `text-ink`, `bg-brand` for the primary button, `border-ink/5` cards, same typography scale. Reuse shadcn `Input`, `Textarea`, and the existing brand button styling pattern from `PrimaryCTA`.
- Lightweight toast on success/error via existing `sonner` setup.

## Landing page changes (`src/routes/index.tsx`)
- Top nav: add `<Link to="/dashboard">Dashboard</Link>` next to the existing "Features" link, same muted style.
- Hero: keep the primary "Start building" CTA, add a secondary ghost-style link "Go to dashboard →" right next to it that routes to `/dashboard`. Subtle styling so it doesn't compete with the brand CTA.

## Out of scope
- Auth / user accounts (explicitly deferred).
- Editing or deleting forms.
- Building/answering forms from the dashboard (only create + list).
- Dark mode, OG image regeneration, copy changes elsewhere on the landing page.
