## Goal
When a logged-in user visits `/`, replace the "Get started" CTA with a profile avatar (initials) dropdown so they can see they're signed in. Unauthenticated users see the current nav unchanged.

## Changes

**`src/routes/index.tsx` — nav section only (lines ~384-407)**

- Already reads `session` via `useAuth()`. Extend to also fetch profile (first_name, last_name, display_name) when session exists, mirroring the dashboard pattern.
- Keep "Features" link always visible.
- When logged out (current behavior):
  - Show "Log in" link + "Get started" PrimaryCTA → `/signup`.
- When logged in:
  - Show "Dashboard" link (already there).
  - Replace "Get started" with an avatar button showing initials (computed from first_name/last_name → display_name → email, same `getInitials` helper as dashboard).
  - Clicking opens a `DropdownMenu` with: identity header (name + email), "Profile" → `/profile`, "Dashboard" → `/dashboard`, separator, "Sign out" (destructive, calls `supabase.auth.signOut()` then navigates to `/`).

## Implementation notes

- Reuse shadcn `DropdownMenu`, `Avatar`, `AvatarFallback` already used in `dashboard.tsx`.
- Extract the avatar dropdown into a small local component `UserMenu` inside `index.tsx` (or a shared `src/components/UserMenu.tsx` if cleaner) to avoid duplicating dashboard logic.
- Profile fetch uses `supabase.from('profiles').select('first_name,last_name,display_name').eq('id', session.user.id).maybeSingle()` inside a `useEffect` gated on `session`.
- No DB/schema changes. No changes to logged-out experience.

## Out of scope
- Mobile menu redesign beyond swapping the CTA.
- Adding a notification bell or other dashboard chrome to the marketing page.
