## Goal
Greet the dashboard user by their display name when they have one, falling back to email.

## Current state
The dashboard already shows `Welcome, {email}`. There is no profiles table yet, so there's nowhere to store a display name.

## Database
New migration:
- Create `public.profiles` table:
  - `id uuid primary key references auth.users(id) on delete cascade`
  - `display_name text` (nullable)
  - `created_at timestamptz default now()`
  - `updated_at timestamptz default now()`
- Enable RLS:
  - SELECT: a user can read their own profile (`auth.uid() = id`)
  - UPDATE: a user can update their own profile
  - INSERT: a user can insert their own profile (covers the trigger path too)
- Trigger `handle_new_user()` on `auth.users` (AFTER INSERT) that creates a matching `profiles` row, seeding `display_name` from `raw_user_meta_data->>'display_name'` if present (otherwise NULL). `SECURITY DEFINER`, `search_path = public`.

(No signup-form change in this turn — the field exists in the DB so a future "edit profile" screen can fill it. The trigger will pick it up automatically when signup starts passing it.)

## Dashboard (`src/routes/dashboard.tsx`)
- Add a profile query keyed by user id that selects `display_name` from `profiles`.
- Compute `greetingName = profile?.display_name?.trim() || email`.
- Render `Welcome, {greetingName}` in the existing subtitle (unchanged layout).

## Out of scope
- A profile editor / settings page
- Adding a display-name field to the signup form
- Avatars or any other profile fields
