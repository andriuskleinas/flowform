## Goal
After clicking the existing "Sign out" button in the dashboard header, send the user to `/login` instead of `/`.

## Current state
`src/routes/dashboard.tsx` already renders a "Sign out" button (with `LogOut` icon) in the header. Its `handleSignOut` calls `supabase.auth.signOut()` then `navigate({ to: "/" })`.

## Change (one-line edit)
- In `handleSignOut`, change `navigate({ to: "/" })` to `navigate({ to: "/login" })`.

## Out of scope
- Restyling the button (it's already in the header next to "Back home")
- Any confirmation dialog
- Sign-out from other pages
