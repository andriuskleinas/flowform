## What's actually happening

You're not on the editor — you're on the **public form page** (`/forms/:id`), which is the page respondents see when they fill in a form. That's why:

- There's no **Add question** button (respondents don't add questions).
- The inputs feel "read-only" — they're not the question label, they're the **answer fields** for the question. The question text "Untitled question" is intentionally not editable here.
- The badge / type editor isn't shown — this page renders the question for answering, not for editing.

The actual editor lives at `/forms/:id/edit` and already has: type badge, label input, options editor, Add question dropdown, move up/down, delete, live preview. You probably landed on the public page by clicking **Open public link** from the editor, then assumed it was still the editor.

## Fix (frontend only, no DB / business-logic changes)

**1. `src/routes/forms.$formId.tsx` (public form page)** — when the signed-in user is the owner, show a prominent banner at the top:

> "You're viewing the public version of this form. **Edit form →**"

The "Edit form" link goes to `/forms/$formId/edit`. Keeps the existing "Back to dashboard" link too. Non-owners (real respondents) see nothing extra.

**2. `src/routes/forms.$formId.edit.tsx` (editor)** — rename the top-right link from **"Open public link"** to **"Preview public form"** with a tooltip / subtitle "(opens the page respondents see)" so it's clear that following it leaves the editor. Keep `target="_blank"` so the editor stays open in the original tab.

**3. `src/routes/dashboard.tsx`** — the **Share link** icon currently copies the public URL silently. Add a tiny visual cue: keep the copy behavior but label the tooltip **"Copy public link"** (currently "Share link") to reduce ambiguity vs. the Pencil = edit icon.

That's it — three small UI/copy tweaks, no schema or logic changes. The "type isn't multiple choice / can't add / can't edit" symptoms all disappear once you're on `/edit` instead of `/forms/:id`.

## Want me to also…?

If after this you still want to change the question type from inside the editor (e.g. realise a question should be Rating instead of Short answer), I can add a type dropdown on each question card in the editor. Say the word and I'll include it.
