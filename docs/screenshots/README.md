# Screenshots

Static screenshots referenced from the root [README.md](../../README.md). The hero image is
[`public/og-image.png`](../../public/og-image.png), which doubles as the social preview.

| File | Used for | Content |
| --- | --- | --- |
| `landing.png` | "The landing page" | Landing hero at 1440 × 900 |
| `fill.png` | "Filling a form" | A respondent mid-flow on a multi-select question, two options picked |
| `analytics.png` | "Measuring results" | Per-question charts from the responses dashboard of a real form |

`landing.png` and `fill.png` are taken at 2× device scale against the local dev server;
`analytics.png` comes from the signed-in production dashboard. When capturing a real
published form, block the `record_form_event` RPC (or use a form you own while signed in) so the
visit doesn't add views to that form's funnel.
