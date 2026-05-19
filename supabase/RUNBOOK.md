# Supabase Migration Runbook

This branch ships **three new SQL migrations** that haven't been applied to
the deployed database yet. Apply them in order, then regenerate the
TypeScript types so the lone cast in `dashboard.tsx` can be removed.

The project ID is `gdutdyimfdrtgfqfemjd` (from `supabase/config.toml`).

---

## 0. One-time setup

If you don't already have the Supabase CLI installed locally:

```bash
brew install supabase/tap/supabase
```

Then log in and link the project:

```bash
supabase login
supabase link --project-ref gdutdyimfdrtgfqfemjd
```

---

## 1. Apply the new migrations

```bash
supabase db push
```

This will apply (in timestamp order):

| Migration | Purpose |
|---|---|
| `20260519140000_data_integrity_constraints.sql` | CHECK constraints (text length, JSONB size) on `forms`, `questions`, `responses`, `profiles`. All `NOT VALID` so the push will not fail on existing data. |
| `20260519141500_dashboard_forms_rpc.sql` | `get_dashboard_forms()` RPC — single round-trip aggregated counts for the dashboard. |
| `20260519143000_response_rate_limit.sql` | Per-(form, IP) and per-form-global rate limit on response submissions. Creates `response_submission_log` and a `BEFORE INSERT` trigger on `responses`. |

If `db push` complains about a checksum mismatch on the rate-limit
migration, see [§ 4](#4-troubleshooting).

---

## 2. (Optional) Enforce CHECK constraints against historical data

The data-integrity constraints are added `NOT VALID`, meaning only **new**
writes are checked. To enforce against existing rows, first audit for
offenders:

```sql
-- forms.title length
SELECT id, char_length(title) AS len
FROM public.forms
WHERE char_length(title) NOT BETWEEN 1 AND 300;

-- responses.answers size
SELECT id, octet_length(answers::text) AS bytes
FROM public.responses
WHERE octet_length(answers::text) > 5000000;
```

Once clean (or after fixing offenders), validate each constraint:

```sql
ALTER TABLE public.forms      VALIDATE CONSTRAINT forms_title_length;
ALTER TABLE public.forms      VALIDATE CONSTRAINT forms_description_length;
ALTER TABLE public.questions  VALIDATE CONSTRAINT questions_label_length;
ALTER TABLE public.questions  VALIDATE CONSTRAINT questions_options_size;
ALTER TABLE public.responses  VALIDATE CONSTRAINT responses_answers_size;
ALTER TABLE public.profiles   VALIDATE CONSTRAINT profiles_display_name_length;
ALTER TABLE public.profiles   VALIDATE CONSTRAINT profiles_first_name_length;
ALTER TABLE public.profiles   VALIDATE CONSTRAINT profiles_last_name_length;
```

---

## 3. Regenerate Supabase TypeScript types

After the migrations are in, refresh the auto-generated types so
`supabase.rpc("get_dashboard_forms")` is properly typed:

```bash
supabase gen types typescript \
  --project-id gdutdyimfdrtgfqfemjd \
  > src/integrations/supabase/types.ts
```

Then **remove the local cast** in `src/routes/dashboard.tsx` — the block
that defines `callDashboardRpc` (~lines 89–95). The original call site
becomes a clean:

```ts
const { data, error } = await supabase.rpc("get_dashboard_forms");
```

Verify nothing breaks:

```bash
bun run typecheck
```

Commit the regenerated types and the cast removal as a single
`chore(types): regenerate supabase types post-migration` commit.

---

## 4. Troubleshooting

**Push fails with constraint violation on the rate-limit migration.**
This means historical responses already exceed 5 MB serialised. Either
clean those rows first or temporarily widen the constraint in the
migration before pushing.

**Migration says "extension pgcrypto already exists".** Safe to ignore —
the migration uses `CREATE EXTENSION IF NOT EXISTS`.

**`db push` says local migrations are out of sync.** Run
`supabase db pull` first to fetch any remote-only migrations, then
`supabase db push` again.

**Rate limit blocks me during testing.** Either:
- Wait one minute for the per-IP window to reset, or
- Temporarily `DROP TRIGGER enforce_response_rate_limit_trigger ON public.responses;`
  and re-create it from the migration when done.

---

## 5. Verification checklist

After everything is applied:

- [ ] `supabase db push` exits clean
- [ ] Dashboard loads without errors (the RPC works)
- [ ] Submitting a response > 5 MB is rejected by the DB
- [ ] Submitting 25 responses to one form from one IP gets rate-limited
- [ ] `bun run typecheck` passes after types regen + cast removal
- [ ] `bun run build` succeeds locally
