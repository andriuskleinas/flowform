I confirmed there is an analytics-style page already implemented at `src/routes/forms.$formId.responses.tsx`, and the dashboard chart icon is intended to navigate to `/forms/$formId/responses`. Since the preview still shows the global 404 at that URL, I’ll make the analytics destination explicit and harder to break.

Plan:

1. **Create a dedicated analytics route**
   - Add a real `/forms/$formId/analytics` page for survey statistics.
   - Move or reuse the existing responses/analytics UI there so the statistics have a clear page to render on.

2. **Update the chart icon navigation**
   - Change the dashboard chart icon to link to `/forms/$formId/analytics` instead of the current responses URL.
   - Keep the label/title aligned with analytics, e.g. “View analytics”.

3. **Keep the old responses URL working**
   - Make `/forms/$formId/responses` redirect or render the same analytics page, so existing links do not 404.

4. **Add route-level fallback handling**
   - If a form is missing or access is denied, show a clear in-app message instead of falling through to the global 404.

5. **Verify in preview**
   - Open the exact form analytics URL and click the dashboard chart icon to confirm the analytics page loads with response counts, duration stats, charts, and individual responses.