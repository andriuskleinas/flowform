# Plan: Update /login screen to match screenshot

## Visual changes (in `src/routes/login.tsx`)
- Replace subheading "Log in to your Flowform account." with "New here? [Create an account]" — the "Create an account" portion is a `<Link to="/signup">` styled in brand color.
- Remove the existing "Don't have an account? Sign up" line at the bottom of the form card (now redundant).
- Keep existing layout: header with logo, centered max-w-md column, white card with Email + Password inputs and full-width pill "Log in" button.

## Files affected
- `src/routes/login.tsx` only.

No business logic, auth, or routing changes.
