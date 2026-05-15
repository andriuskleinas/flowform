## Problem

Clicking "Sign out" on the dashboard redirects to `/login?redirect=/dashboard` instead of the home page `/`.

The handler at `src/routes/dashboard.tsx:189-192` does call `navigate({ to: "/" })`, but the dashboard's auth guard `useEffect` (lines 53–57) fires immediately afterward: when Supabase clears the session, `user` becomes `null`, and the effect navigates to `/login?redirect=/dashboard`, overwriting the home navigation.

## Fix

In `src/routes/dashboard.tsx`, add a `signingOut` ref (or state) and skip the auth-guard redirect while a sign-out is in flight.

1. In `DashboardPage`, lift a shared `signingOutRef` (useRef) and pass it down, OR simpler: move `handleSignOut` into `DashboardPage` so it can flip the same ref the guard checks.

Simplest concrete approach:
- In `DashboardPage`, add `const signingOutRef = useRef(false);`
- Update the guard:
  ```ts
  useEffect(() => {
    if (!authLoading && !user && !signingOutRef.current) {
      navigate({ to: "/login", search: { redirect: "/dashboard" } });
    }
  }, [authLoading, user, navigate]);
  ```
- Pass `signingOutRef` into `DashboardAuthed` as a prop.
- In `handleSignOut` (in `DashboardAuthed`):
  ```ts
  const handleSignOut = async () => {
    signingOutRef.current = true;
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };
  ```

No other files need changes. Pure frontend fix.
