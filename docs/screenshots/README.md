# Screenshots

Static screenshots referenced from the root [README.md](../../README.md). The top-of-README demo
is a linked Loom video rather than a file in this folder, and the hero image is
[`public/og-image.png`](../../public/og-image.png), which doubles as the social preview.

| File | Used for | Content |
| --- | --- | --- |
| `landing.png` | "The landing page" | Landing hero at 1440 × 800 |
| `fill.png` | "Filling a form" | A respondent mid-flow on a multi-select question, two options picked |
| `analytics.png` | "Measuring results" | The responses dashboard: metrics, Claude summary and funnel |

All shots are taken at 2× device scale against the local dev server. When capturing a real
published form, block the `record_form_event` RPC (or use a form you own while signed in) so the
visit doesn't add views to that form's funnel.
