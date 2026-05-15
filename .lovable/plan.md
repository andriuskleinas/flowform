# Plan: Redirect "Get Started" to Signup

## Problem
The "Get Started" CTA buttons on the landing page currently link to `/demo` unconditionally. Users who are not signed in should be directed to `/signup` first.

## Solution
Make the `PrimaryCTA` component auth-aware in `src/routes/index.tsx`:
- If the user is **not authenticated**, the "Get started" / "Start building" buttons navigate to `/signup`.
- If the user **is authenticated**, they navigate to `/dashboard` (where they can actually create forms).

## Changes
1. **src/routes/index.tsx**
   - Pass `session` (or an `isAuthenticated` flag) into `PrimaryCTA`.
   - Update `PrimaryCTA`'s `<Link>` `to` prop:
     - `session` present → `/dashboard`
     - `session` absent → `/signup`
   - Update the nav link label from "Get started" to something context-appropriate (or keep as-is).

## Files affected
- `src/routes/index.tsx` only.

## Technical details
- Use the existing `useAuth()` hook already imported in `Index`; `session` is already destructured.
- `PrimaryCTA` currently accepts `children`, `size`, and `variant`. Add an optional `to` prop, or compute the destination inside the component using the passed `session`.
- Use `<Link to="/signup">` and `<Link to="/dashboard">` from `@tanstack/react-router` for type-safe navigation.
