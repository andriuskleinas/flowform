## Problem

The Share button copies `${window.location.origin}/forms/${id}`. When used from the editor preview (`id-preview--*.lovable.app`), the origin is the **preview host**, which is gated by a Lovable account login — recipients hit a Lovable sign-in wall before they ever reach the form.

Two separate things need fixing for sharing to actually work for outside recipients:

1. **Wrong origin** — share links must point at the **published** host, not the preview host.
2. **Draft forms** — even on the right host, a `draft` form returns "This form isn't published yet" to non-owners (RLS blocks `SELECT` for non-owners; the public route shows the draft notice). A share link is meaningless until the form is published.

## Fix

File: `src/routes/dashboard.tsx` (and the same Share affordance on `src/routes/forms.$formId.edit.tsx` if present — verify during implementation).

### 1. Build the share URL from the published host, not `window.location.origin`

Use the project's stable public URL:

```
https://project--28b39e04-4acb-4c0b-ad92-f35af8b0c276.lovable.app/forms/${formId}
```

This URL is immutable, serves the published deployment, and does **not** require a Lovable login. (If a custom domain is later configured, the same URL keeps working; we can swap it out then.)

Implementation detail: put the host in a single constant at the top of the file (e.g. `const PUBLIC_SITE_ORIGIN = "https://project--28b39e04-4acb-4c0b-ad92-f35af8b0c276.lovable.app"`) so there's one place to change it.

### 2. Gate sharing on publish status

Per-form Share button behavior:

- **`status === "published"`** — copy the public URL, toast `"Link copied"`.
- **`status === "draft"`** — do **not** copy. Show a toast like `"Publish this form before sharing"` with an action that takes the user to the editor (where Publish lives). Visually dim the Share icon and set `title="Publish to enable sharing"` so the state is discoverable before clicking.

No DB or RLS changes — published forms + their questions are already readable by `public` per the existing policies, and `responses` already accepts anonymous inserts for published forms. The only bug is the link host and the missing draft guard.

## Out of scope

- Custom-domain detection (we hard-code the stable `project--<id>.lovable.app` host; it already serves the published app).
- Any change to the public form page, RLS, or the responses flow.
- Any change to the editor's Save/Publish logic beyond the dimmed-Share affordance.
