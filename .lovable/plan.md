Add a question-count badge to each form card on the dashboard.

In `src/routes/dashboard.tsx`:
1. Add a `questionCounts` query mirroring the existing `responseCounts` query — `select("form_id").in("form_id", ids)` against `questions`, tally into `Record<string, number>`.
2. In the form card meta line, render the question count before the response count: `"{q} questions · {r} responses · {timeAgo}"` (singular "question"/"response" when count is 1).

No DB changes, no other files touched.