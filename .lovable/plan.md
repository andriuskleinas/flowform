## Goal
Add Lovable Cloud auth (email + password), gate the dashboard behind login, and scope forms to the signed-in user.

## Database
Migration on `public.forms`:
- Add `user_id uuid not null references auth.users(id) on delete cascade` (backfill: since current rows are anonymous, drop existing rows or set them to a placeholder — recommend `DELETE FROM forms` since the app is pre-launch and rows are public test data).
- Add index on `user_id`.
- Replace the permissive RLS policies with owner-scoped ones:
  - `SELECT`: `auth.uid() = user_id`
  - `INSERT`: `auth.uid() = user_id` (with check)
  - (no UPDATE/DELETE yet — out of scope)

Auth config: enable email/password, **disable** auto-confirm so users verify email — but the user said "after signing up, users should be logged in automatically", so we'll enable auto-confirm to match that requirement. No Google login since the user didn't ask. No profiles table (email is enough for the welcome message).

## Routes

New files:
- `src/routes/signup.tsx` — email + password form, calls `supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + '/dashboard' } })`. On success, navigate to `/dashboard`. Link to `/login`.
- `src/routes/login.tsx` — email + password form, calls `supabase.auth.signInWithPassword`. On success, navigate to `/dashboard` (or `?redirect=` target). Link to `/signup`. Reads `redirect` from search params.

Both pages: same Flowform header style as dashboard, centered card, sonner toasts for errors.

### Auth gate

Use the standard pattern: a small `useAuth` hook in the dashboard route that:
- Sets up `supabase.auth.onAuthStateChange` first, then calls `getSession()`.
- While loading: render skeleton.
- If no session after load: `navigate({ to: '/login', search: { redirect: '/dashboard' } })`.

(Using a component-level guard rather than a `_authenticated` layout route to keep the change small and avoid restructuring the existing route tree.)

### Dashboard updates (`src/routes/dashboard.tsx`)

- Subtitle/heading area shows `Welcome, {session.user.email}` and a small "Sign out" button (calls `supabase.auth.signOut()` then navigates to `/`).
- Forms query: still `select(...).order('created_at', desc)`. RLS does the filtering, but we also add `.eq('user_id', session.user.id)` for clarity.
- Insert mutation: include `user_id: session.user.id` in the payload.
- Query key includes user id so it refetches on user change.

## Landing page (`src/routes/index.tsx`)
- Top nav: replace the "Dashboard" link with conditional "Log in" / "Sign up" when logged out, or "Dashboard" when logged in. Keep it simple — a small `useSession` hook.
- Hero secondary CTA still points to `/dashboard` (the gate redirects unauth'd users to login).

## Out of scope
- Google OAuth, password reset, email verification UI, profiles table, edit/delete forms, Google sign-in.
