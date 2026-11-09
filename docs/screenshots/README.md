# Screenshots

Static screenshots referenced from the root [README.md](../../README.md). The hero image is
[`public/og-image.png`](../../public/og-image.png), which doubles as the social preview.

| File | Used for | Content |
| --- | --- | --- |
| `landing.png` | "The landing page" | Landing hero at 1440 × 900 |
| `ai-suggestions.png` | "Drafting questions with Claude" | Real Claude suggestions in the editor of a live form |
| `fill.png` | "Filling a form" | A respondent mid-flow on a multi-select question, two options picked |
| `analytics.png` | "Reading the results" | Metrics and the Claude summary on a real form's responses dashboard |

`landing.png` and `fill.png` are taken at 2× device scale against the local dev server;
`ai-suggestions.png` and `analytics.png` come from the signed-in production app. Both AI
features only read data, so generating them for a screenshot changes nothing in the account.

When capturing a real published form while signed out, block the `record_form_event` RPC so the
visit doesn't add views to that form's funnel.
