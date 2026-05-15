## Goal

Make the chart icon (Dashboard → form's responses link) open an analytics view showing summary stats and per-question visual breakdowns, in addition to the raw response list.

## Where

`src/routes/forms.$formId.responses.tsx` — already the destination of the chart icon. Extend it; no routing or dashboard changes.

## What the page shows

Top: tabs (or two stacked sections) — **Overview** and **Individual responses**.

### Overview — summary cards
- Total responses
- Responses in last 7 days
- Average completion time *(see "Duration" below)*
- Completion rate (responses with all questions answered ÷ total)

### Overview — charts
- **Responses over time** — line/area chart, daily counts (last 30 days). Uses `submitted_at`.
- **Per-question breakdown**, one card each:
  - `multiple_choice` → horizontal bar chart of option counts (handles arrays for multi-select)
  - `rating` → bar chart of 1..max star distribution + average rating
  - `text` → count of answered vs skipped + a list of the most recent N answers (truncated)

Built with `recharts` (already a dep — `src/components/ui/chart.tsx` exists). Use design tokens (`--primary`, `--muted`, etc.); no hard-coded colors.

### Individual responses
Existing list, kept as-is, moved under the second tab.

## Duration to answer

The DB only has `submitted_at` — no start timestamp — so we can't compute true fill time from existing data.

Proposal: add a `started_at` field tracked client-side.

- Migration: `ALTER TABLE public.responses ADD COLUMN started_at timestamptz;` (nullable, so old rows still work).
- Public form page (`src/routes/forms.$formId.index.tsx`): record `Date.now()` when the form first renders and send it as `started_at` on submit. RLS insert policy already allows anonymous inserts on published forms; column is nullable so no policy change needed.
- Analytics: when both timestamps exist, compute `submitted_at - started_at`; show median + average; ignore rows where `started_at` is null or duration > 2h (likely tab left open).
- If no rows have durations yet, show "Not enough data yet" instead of a number.

## Technical notes

- Reuse the existing auth-gated query pattern in the file (no schema for ownership change).
- Aggregations done client-side in `useMemo` from the already-fetched `responses` + `questions` arrays — no extra queries.
- Tabs via existing `@/components/ui/tabs`.
- Charts via `recharts` + `ChartContainer`/`ChartTooltipContent` from `src/components/ui/chart.tsx`.
- Empty states for each chart when a question has zero answers.

## Out of scope

- CSV export, filtering, date-range picker, per-respondent drill-down — can be follow-ups.
