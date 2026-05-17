## Replace dashboard "Back home" link with a profile dropdown

In `src/routes/dashboard.tsx`, the header currently renders a "Back home" link next to "Sign out". Since the user is already inside the app, that link is redundant. Replace it with a user profile dropdown that consolidates account actions into one menu.

### Header changes (`src/routes/dashboard.tsx`)

Remove:
- The `<Link to="/">… Back home</Link>` element
- The standalone "Sign out" `<button>` (moves into the dropdown)
- The now-unused `ArrowLeft` and `LogOut` imports (keep `LogOut` if used inside the dropdown)

Add a profile dropdown on the right of the nav:
- Trigger: circular avatar button showing the user's initials (derived from `profile.display_name` or `email`), with `bg-brand/10 text-brand`, size 9, ring on hover/focus for accessibility. `aria-label="Open account menu"`.
- Use the existing shadcn `DropdownMenu` primitives (`src/components/ui/dropdown-menu.tsx`) — already in the project.
- Menu content (aligned end, width ~64):
  - Header block (non-interactive): bold `display_name` (or "Account" fallback) + muted `email` underneath
  - `DropdownMenuSeparator`
  - `DropdownMenuItem` → "Home" (navigates to `/`) with `Home` icon — keeps the marketing site reachable without it living in the primary nav
  - `DropdownMenuItem` → "New form" (navigates to `/forms/new`) with `Plus` icon — quick action from anywhere
  - `DropdownMenuSeparator`
  - `DropdownMenuItem` → "Sign out", destructive styling (`text-destructive focus:text-destructive`), `LogOut` icon, calls existing `handleSignOut`

### Why this is valuable

- Removes a confusing in-app "Back home" affordance
- Surfaces identity (initials + email) so users know which account they're in
- Keeps "Home" reachable for users who do want to visit the landing page, but demotes it from primary nav
- Adds a fast "New form" shortcut available from any dashboard scroll position
- Sign out remains one click away, just grouped with account context

### Technical notes

- Initials helper: take first letters of `display_name` words (max 2), fallback to first 2 chars of email local-part, uppercase.
- `profile` query already exists in `DashboardAuthed`; reuse it. While loading, render initials from email so the avatar never flashes empty.
- No new dependencies. No route, schema, or data changes. Edit is scoped to the header `<nav>` inside `DashboardPage` / `DashboardAuthed` in `src/routes/dashboard.tsx`.
