## Plan

1. **Use the correct public domain**
   - Replace the current hard-coded share host with the actual published app URL: `https://flowformapp.lovable.app`.
   - This avoids both preview domains and `lovableproject.com`, which route recipients through the Lovable login portal.

2. **Centralize share URL creation**
   - Add a small shared helper for public form URLs, e.g. `getPublicFormUrl(formId)`.
   - Use that helper anywhere the app copies, displays, or opens a respondent form link so future fixes are made in one place.

3. **Fix all share/copy affordances**
   - Update the dashboard Share button to copy `https://flowformapp.lovable.app/forms/<formId>`.
   - Search for any other form-share code paths and update them to the same helper if present.
   - Keep the existing draft guard: draft forms should not be copied until published.

4. **Update the internal note**
   - Update `.lovable/plan.md` so the documented public URL matches the current published domain and no longer references the wrong `project--...lovable.app` host.

5. **Validate**
   - Verify the copied link string is exactly `https://flowformapp.lovable.app/forms/df9ddaf9-5935-4c66-952b-e5c0b05626ba` for that form.
   - Confirm no code still generates form links with `window.location.origin`, `lovableproject.com`, or the old `project--...lovable.app` host.