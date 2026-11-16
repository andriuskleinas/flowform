# Screenshots

Static screenshots referenced from the root [README.md](../../README.md). The hero image is
[`public/og-image.png`](../../public/og-image.png), which doubles as the social preview.

| File | Used for | Content |
| --- | --- | --- |
| `landing.png` | "The landing page" | Landing hero at 1440 × 900 |
| `landing-demo.png` | "The landing page" | The hero demo after answering: the visitor's response in the results |
| `dashboard.png` | "The dashboard" | Dashboard with the app shell, demo data |
| `dashboard-dark.png` | "The dashboard" | The same in dark mode |
| `editor.png` | "Building a form" | Editor of a locked live form, demo data |
| `ai-suggestions.png` | "Building a form" | Real Claude suggestions in the editor of a draft form |
| `fill.png` | "Filling a form" | A respondent mid-flow on a multi-select question |
| `analytics.png` | "Reading the results" | Ask your results, metrics and the Claude summary on a real form |
| `live.png` | "Presenting live" | Presenter view with an NPS question, demo data |
| `guide.png` | "The guide" | In-app feature guide |

All at 2× device scale. `landing*.png` and `fill.png` come from the local dev server, signed
out. `ai-suggestions.png` and `analytics.png` come from the signed-in production app; both AI
features only read data, so generating them changes nothing in the account.

`dashboard*.png`, `editor.png`, `live.png` and `guide.png` (retaken 2026-11-16) are rendered from
the local app with Playwright: a fake session in localStorage and every Supabase request answered
from fixtures, so they show clean demo data and need no login. Realtime is blocked in that setup,
so the live view's status badge is set to its connected state for the capture.

When capturing a real published form while signed out, block the `record_form_event` and
`save_response_progress` RPCs so the visit adds no views or partial responses to that form.
