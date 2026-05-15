## Replace "New form" modal with a dedicated page

Today, clicking **+ New form** on the dashboard opens a popup with title, description, and a single first‑question type. You want a full page instead, where you can also write the actual question text and add multiple questions before saving.

### New route: `/forms/new`

Create `src/routes/forms.new.tsx` — a protected page (redirects to `/login` if signed out) with this layout:

- Header: back link to **Dashboard**, page title "Create a new form".
- **Form details** card
  - Title (required, max 120 chars)
  - Description — "What's this form for?" (optional, max 500 chars)
- **Questions** card — a list of question editors. Each row has:
  - Question text input ("Type your question…")
  - Question type dropdown (Short answer / Multiple choice / Rating)
  - When type is *Multiple choice*: inline option editor (add/remove options)
  - When type is *Rating*: max-stars selector (3–10)
  - Remove-question button (disabled when only one remains)
- **+ Add question** button below the list — appends a new blank question (defaults to Short answer).
- Footer actions: **Cancel** (back to dashboard) and **Create form** (primary).

### Save behavior

On **Create form**:
1. Validate: title non-empty, every question has non-empty label, multiple-choice questions have ≥2 non-empty options.
2. Insert the form row (`forms`) with `user_id`, `title`, `description`, `status: 'draft'`.
3. Insert all questions in `questions` with sequential `position` values.
4. On success: toast "Form created", invalidate `["forms", userId]`, navigate to `/forms/:id/edit` (so you can keep editing or publish).
5. On error: toast the message; keep the page state so nothing is lost.

### Dashboard changes (`src/routes/dashboard.tsx`)

- Replace the modal-opening **+ New form** button (and the empty‑state CTA) with a `<Link to="/forms/new">` styled the same way.
- Remove the dialog state, the `createForm` mutation, and the `DialogPrimitive.*` block — they move to the new page.
- Keep everything else (list, sign-out, share, responses links) unchanged.

### Notes

- Reuses existing `forms` and `questions` tables — no schema changes.
- Visual style matches the current dashboard / edit page (rounded-2xl cards, brand button, `bg-surface`, semantic tokens).
- The new page is purely frontend; auth, RLS, and data model are unchanged.
