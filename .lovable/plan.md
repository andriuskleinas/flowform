Add a "Back to dashboard" link to the public form page (`src/routes/forms.$formId.tsx`), shown **only when the current viewer is the form's owner** — so respondents who open the share link don't see it.

Implementation:
1. Use `useAuth()` to get the current user.
2. Compare `user?.id === formQ.data.user_id` — for this we need to also select `user_id` in the `formQ` query.
3. When true, render a small `<Link to="/dashboard">← Back to dashboard</Link>` above the form header (and a matching one on the thank-you and not-found states).

No DB or routing changes.