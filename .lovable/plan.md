## What already works

The editor at `/forms/:id/edit` already covers 5 of the 6 requirements:

- Add questions with type **Short answer / Multiple choice / Rating** (Add question dropdown).
- Edit a question's text (label input, saves on blur).
- Reorder questions via Up/Down arrows — `position` is persisted to the DB, so order survives refresh.
- Delete questions (trash icon).
- Live preview pane on the right, plus "Preview public form" link that opens the respondent view in a new tab.

The only missing piece is **draft / published status**.

## What I'll add

### 1. Database (one migration)

Add a `status` column to `forms`:

- `status text not null default 'draft'` with a CHECK for `'draft' | 'published'`.
- Replace the existing `Anyone can view forms` SELECT policy so the public can only see forms where `status = 'published'`. Owners keep full visibility via the existing `Users can view their own forms` policy.
- Mirror the same gate on `questions` (public can only read questions whose parent form is published).
- Same gate on `responses` insert: only allow inserting against a published form.

### 2. Editor (`src/routes/forms.$formId.edit.tsx`)

- Show a status pill next to the title: gray "Draft" or green "Published".
- Add a **Publish** / **Unpublish** button in the header. Toggles `forms.status` and invalidates the form query. Toast on success.
- Keep "Preview public form" — owners can always preview even when draft (RLS allows it for the owner).

### 3. Public form page (`src/routes/forms.$formId.tsx`)

- If the form is draft and the viewer is **not** the owner, show "This form isn't published yet" instead of the questions / submit button.
- If the form is draft and the viewer **is** the owner, show an extra warning line in the existing owner banner: "Draft — respondents can't see this yet."

### 4. Dashboard (`src/routes/dashboard.tsx`)

- Add a small Draft / Published pill on each form card next to the title.
- New forms still default to `draft` (no change to the create flow).

## Out of scope

- Drag-and-drop reordering — current Up/Down arrows already persist order. Happy to add later if you want.
- Anything around private/invited-only forms — that was a different earlier idea, not part of this request.

## Files touched

- new migration: add `status` to `forms` + updated RLS on `forms`, `questions`, `responses`
- `src/routes/forms.$formId.edit.tsx` — status pill + publish toggle
- `src/routes/forms.$formId.tsx` — gate non-owner view on published
- `src/routes/dashboard.tsx` — status pill per card
