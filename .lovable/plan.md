# Form builder: questions + public responses

Build form creation (questions of multiple types) and a public response flow, then surface response counts and a viewer back on the dashboard. No changes to auth.

## Database (one migration)

**`questions` table**
- `id` uuid pk
- `form_id` uuid → `forms.id` on delete cascade
- `type` text — enum-like: `'text' | 'multiple_choice' | 'rating'`
- `label` text not null
- `options` jsonb — for `multiple_choice` (array of strings); for `rating` an object like `{ max: 5 }`; null for `text`
- `position` int not null — ordering, survives refresh
- `created_at` timestamptz default now()
- Index on `(form_id, position)`

RLS:
- Owner can SELECT/INSERT/UPDATE/DELETE their own questions (via `forms.user_id = auth.uid()` join check)
- Anyone (anon + authenticated) can SELECT questions where the parent form exists — needed for the public fill page

**`responses` table**
- `id` uuid pk
- `form_id` uuid → `forms.id` on delete cascade
- `answers` jsonb not null — shape: `{ [questionId]: answerValue }`
- `submitted_at` timestamptz default now()
- Index on `form_id`

RLS:
- Anyone (anon + authenticated) can INSERT a response for any existing form (anonymous submissions)
- Only the form owner can SELECT responses (`forms.user_id = auth.uid()`)
- No UPDATE/DELETE policies (immutable submissions)

**Existing `forms` table** — also needs a public SELECT policy so anonymous visitors can read title/description on the public page. Currently only owners can SELECT. Add a second policy: `SELECT TO anon, authenticated USING (true)`. Existing owner policy stays.

Pre-existing forms (title + description only) keep working — they just have zero rows in `questions` until the owner adds some.

## Routes

```
src/routes/
  dashboard.tsx                      (existing, edited)
  forms.$formId.edit.tsx             NEW — owner-only question builder
  forms.$formId.responses.tsx        NEW — owner-only response list
  forms.$formId.tsx                  NEW — PUBLIC fill page (anon allowed)
```

The public `/forms/$formId` route uses the browser supabase client with the anon/publishable key — RLS does the gatekeeping. No auth guard on this route.

The two owner pages live as plain top-level routes (not under `_authenticated`) and do their own redirect-if-not-owner check, matching how `dashboard.tsx` already handles auth. They query with the user's session so RLS naturally returns nothing for non-owners; the UI shows a "Not found / no access" state in that case.

## Part 1 — Question builder (`/forms/$formId/edit`)

Layout: two columns on desktop, stacked on mobile.
- **Left**: editable question list
  - Each row: question type badge, editable label input, type-specific editor (options list for multiple choice, max-stars selector for rating), up/down/delete buttons
  - "Add question" dropdown at the bottom: Text / Multiple choice / Rating
  - Reorder via up/down buttons (simpler, no extra dependency); persists `position`
- **Right**: live preview pane that renders questions exactly as the public page would (read-only)

State: load questions via react-query, mutations for create/update/delete/reorder. Reorder = swap `position` values of two adjacent rows in a single update call. Save is auto on blur for label edits; explicit for structural changes.

Header has "Back to dashboard" and "Open public link" (just navigates to `/forms/$formId` in a new tab).

## Part 2 — Public fill page (`/forms/$formId`)

- No auth required.
- Fetch form (title, description) + questions ordered by `position`.
- Render inputs by type:
  - `text` → `<Input>` (or `<Textarea>` if label is long; keep it simple — `<Input>`)
  - `multiple_choice` → shadcn `RadioGroup` over `options`
  - `rating` → row of star buttons (1..max), filled-state on click
- Required: all questions required for v1 (keeps validation trivial). Submit disabled until all answered.
- On submit: insert into `responses` with `{ form_id, answers: { [qid]: value } }`. Show a thank-you card replacing the form ("Thanks! Your response was recorded.") with no link back to the dashboard (respondent isn't necessarily the owner).
- Loading + not-found states.
- `head()` with the form title for shareable previews.

## Part 3 — Dashboard surface

In the existing `forms` list rows in `dashboard.tsx`:
- Add a per-form **response count** badge. Fetched via a single grouped query: `supabase.from('responses').select('form_id', { count: 'exact', head: false })` then group client-side, OR a small RPC. Simpler: extend the `forms` query to also pull a count using a Postgres view or, easiest, do one extra `responses` query that returns `form_id` only and tally in JS. Pick the JS-tally approach — no schema gymnastics.
- Add three actions per row (icon buttons + tooltips):
  - **Edit** → `/forms/$formId/edit`
  - **Share link** → copies `window.location.origin + '/forms/' + formId` to clipboard, toasts "Link copied". Uses `window.location.origin` so it works on preview, published, and custom domains.
  - **View responses** → `/forms/$formId/responses` (shows count next to the label)
- Clicking the row body itself also navigates to Edit.

The existing "Create form" dialog stays as-is. After creating, optionally redirect to the new form's edit page so the user can immediately add questions (small UX win, low risk).

## Responses page (`/forms/$formId/responses`)

- Owner-only (RLS enforces; UI shows empty/no-access if query returns nothing and form exists).
- Header: form title + total count + back link.
- Table-ish list: each row = one response, showing `submitted_at` (relative time + tooltip with absolute) and each question's answer rendered by type (stars rendered visually, multiple choice as the chosen option string, text as plain text).
- Empty state when no responses yet, with the share link button repeated for convenience.

## Out of scope (call out so it doesn't creep)

- Drag-and-drop reorder (using up/down buttons instead)
- Optional vs required questions, validation rules, conditional logic
- Editing/deleting submitted responses
- CSV export (easy to add later)
- Pagination on responses list (fine for v1; can add when needed)
- Realtime updates of response count

## Order of operations

1. Migration: `questions` + `responses` tables, RLS, and public-read policy on `forms`.
2. Public fill route `/forms/$formId` (smallest surface, validates the schema end-to-end).
3. Question builder route `/forms/$formId/edit` with live preview.
4. Dashboard updates: counts, share button, action buttons; redirect after create → edit.
5. Responses route `/forms/$formId/responses`.
