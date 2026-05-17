## Profile page + dropdown cleanup

### 1. Dropdown changes (`src/routes/dashboard.tsx`)
- Remove the **New form** menu item (the page already has a primary "New form" button).
- Replace the **Home** menu item with a **Profile** item (`User` icon) that navigates to `/profile`.
- Keep the identity header (name + email) and Sign out item unchanged.
- Drop the now-unused `Home` and `Plus` icon imports.

### 2. Database — add name fields to `profiles`
Current `profiles` table only has `display_name`. The user wants separate **Name** (first) and **Surname** (last) editable fields. Plan a migration:
- Add `first_name text` and `last_name text` (both nullable) to `public.profiles`.
- Add an `updated_at` trigger that calls the existing `update_updated_at_column` pattern (the column already exists; just wire a `BEFORE UPDATE` trigger if one isn't there).
- Backfill: leave existing rows as-is; `display_name` stays for compatibility (we'll keep showing initials/menu name from `first_name + last_name`, falling back to `display_name` then email).

Email lives on `auth.users` — not duplicated in `profiles`. Account creation date comes from `auth.users.created_at` via `supabase.auth.getUser()`.

### 3. New route `src/routes/profile.tsx`
Authenticated page (same auth gate pattern as `/dashboard` — redirect to `/login` if no session). Layout matches dashboard chrome: same header (logo + the new profile dropdown), main content with a max-w-2xl card.

Contents:
- **Header**: "Profile" h1 + muted subtitle "Manage your account details".
- **Read-only summary row**: Account created on `{format(auth.users.created_at, 'MMM d, yyyy')}` displayed as a small muted line.
- **Edit form** (single card, shadcn `Input` + `Label`):
  - First name (`first_name`)
  - Last name (`last_name`)
  - Email (`email`) — prefilled from session
- **Save button** (brand pill):
  - If name fields changed → `supabase.from('profiles').update({ first_name, last_name, display_name: \`${first} ${last}\`.trim() || null }).eq('id', userId)`.
  - If email changed → `supabase.auth.updateUser({ email: newEmail })`. Toast: "Confirmation email sent to your new address. Click the link to finalize the change." (Supabase requires confirmation; that's expected behavior.)
  - Disable button while submitting; toast success/error via sonner.
- **Validation** (zod, client-side):
  - `first_name`/`last_name`: trim, max 50 chars, allow empty.
  - `email`: `z.string().email().max(255)`.
- **Back link**: small "← Back to dashboard" above the heading.

### 4. Data loading on the profile page
Use React Query keyed `['profile', userId]`:
- Fetch `profiles` row (`first_name, last_name, display_name`).
- Get `auth.users` info (email, created_at) from `supabase.auth.getUser()` — no extra query needed.
- Initialize form state from fetched data; reset on successful save.

### 5. Dashboard dropdown identity update
Update `getInitials` (already added) to prefer `first_name`/`last_name` initials, then fall back to `display_name`, then email. Update the dropdown header to show `${first_name} ${last_name}` when present, else `display_name`, else "Account".

### 6. Out of scope
- No password change flow (user didn't ask).
- No avatar upload.
- No deletion / account close.

### Files touched
- New: `src/routes/profile.tsx`
- Edited: `src/routes/dashboard.tsx` (dropdown items, icon imports, initials/name fallback)
- Migration: add `first_name`, `last_name` columns to `public.profiles` (+ update trigger if missing)
