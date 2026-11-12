import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { getRatingMax, type AnswerValue, type Answers, type FollowUps } from "@/lib/form-utils";
import type { Question } from "@/components/question-render";

/** The fields of a submitted response the table needs. */
export type TableResponse = {
  id: string;
  submitted_at: string;
  form_version: number;
  answers: Answers;
  follow_ups: FollowUps;
  score: number | null;
  meta: { source?: string; referrer?: string } | null;
};

type Row = {
  id: string;
  at: string;
  version: number;
  answers: Answers;
  followUps: FollowUps;
  score: number | null;
  source: string | null;
  unfinished: boolean;
};

/** Plain-text rendering of one answer for a table cell (and its tooltip). */
export function answerText(question: Question, value: AnswerValue | undefined): string {
  if (value === undefined || value === null || value === "") return "";
  if (Array.isArray(value)) return value.join(", ");
  if (question.type === "rating") return `${value} / ${getRatingMax(question.options)}`;
  return String(value);
}

/**
 * Spreadsheet-style grid of individual responses: one row per response, one
 * column per question. Optionally mixes in unfinished (partial) sessions.
 */
export function ResponsesTable({
  formId,
  version,
  questions,
  responses,
  showVersion,
  allowUnfinished,
}: {
  formId: string;
  version: number | null;
  questions: Question[];
  responses: TableResponse[];
  showVersion: boolean;
  /** False while an "Ask" filter is active: partials aren't part of it. */
  allowUnfinished: boolean;
}) {
  const [withUnfinished, setWithUnfinished] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const partialsQ = useQuery({
    enabled: withUnfinished && allowUnfinished,
    queryKey: ["partial-sessions", formId, version],
    queryFn: async () => {
      let q = supabase
        .from("response_sessions")
        .select("id, updated_at, form_version, answers")
        .eq("form_id", formId)
        .is("completed_at", null);
      if (version != null) q = q.eq("form_version", version);
      const { data, error } = await q.order("updated_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows: Row[] = useMemo(() => {
    const done: Row[] = responses.map((r) => ({
      id: r.id,
      at: r.submitted_at,
      version: r.form_version,
      answers: r.answers ?? {},
      followUps: r.follow_ups ?? {},
      score: r.score,
      source: r.meta?.source ?? r.meta?.referrer ?? null,
      unfinished: false,
    }));
    if (!withUnfinished || !allowUnfinished) return done;
    const partial: Row[] = (partialsQ.data ?? [])
      .filter((p) => p.answers && Object.keys(p.answers as object).length > 0)
      .map((p) => ({
        id: p.id,
        at: p.updated_at,
        version: p.form_version,
        answers: (p.answers ?? {}) as Answers,
        followUps: {},
        score: null,
        source: null,
        unfinished: true,
      }));
    return [...done, ...partial].sort((a, b) => b.at.localeCompare(a.at));
  }, [responses, partialsQ.data, withUnfinished, allowUnfinished]);

  const hasScore = responses.some((r) => r.score != null);
  const hasSource = rows.some((r) => r.source);
  const colCount = 1 + questions.length + (hasScore ? 1 : 0) + (hasSource ? 1 : 0);

  return (
    <div>
      {allowUnfinished && (
        <label className="mb-3 inline-flex cursor-pointer items-center gap-2 text-sm text-ink/70">
          <input
            type="checkbox"
            checked={withUnfinished}
            onChange={(e) => setWithUnfinished(e.target.checked)}
            className="size-4 accent-[var(--brand)]"
          />
          Include unfinished responses
          {withUnfinished && partialsQ.data && (
            <span className="font-mono text-xs text-ink/45">
              ({rows.filter((r) => r.unfinished).length})
            </span>
          )}
        </label>
      )}

      <div className="max-h-[70vh] overflow-auto rounded-lg border border-hairline bg-card">
        <table className="w-max min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 border-b border-r border-hairline bg-surface px-3 py-2 font-mono text-[10px] font-normal uppercase tracking-wide text-ink/50">
                Submitted
              </th>
              {hasScore && <HeadCell>Score</HeadCell>}
              {hasSource && <HeadCell>Source</HeadCell>}
              {questions.map((q, i) => (
                <th
                  key={q.id}
                  title={q.label}
                  className="sticky top-0 z-10 max-w-[16rem] border-b border-hairline bg-surface px-3 py-2 text-xs font-medium text-ink"
                >
                  <span className="mr-1.5 font-mono text-[10px] text-ink/40">Q{i + 1}</span>
                  <span className="line-clamp-2">{q.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-3 py-8 text-center text-ink/50">
                  No responses yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <Fragment key={r.id}>
                <tr
                  onClick={() => setOpen((o) => (o === r.id ? null : r.id))}
                  aria-expanded={open === r.id}
                  className="cursor-pointer hover:bg-ink/[0.03]"
                >
                  <td className="sticky left-0 z-[5] whitespace-nowrap border-b border-r border-hairline bg-card px-3 py-2 font-mono text-xs text-ink/70">
                    {new Date(r.at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {showVersion && <span className="ml-1.5 text-ink/40">v{r.version}</span>}
                    {r.unfinished && (
                      <span className="ml-2 rounded-sm bg-amber-100 px-1.5 py-px font-sans text-[10px] font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                        Unfinished
                      </span>
                    )}
                  </td>
                  {hasScore && (
                    <BodyCell>
                      {r.score != null ? <span className="font-mono">{r.score}</span> : null}
                    </BodyCell>
                  )}
                  {hasSource && <BodyCell>{r.source}</BodyCell>}
                  {questions.map((q) => {
                    const text = answerText(q, r.answers[q.id]);
                    return (
                      <BodyCell key={q.id} title={text}>
                        {text || <span className="text-ink/25">—</span>}
                      </BodyCell>
                    );
                  })}
                </tr>
                {open === r.id && (
                  <tr>
                    <td
                      colSpan={colCount}
                      className="border-b border-hairline bg-surface/60 px-4 py-4"
                    >
                      <dl className="grid max-w-3xl gap-3">
                        {questions.map((q, i) => {
                          const text = answerText(q, r.answers[q.id]);
                          const fu = r.followUps[q.id];
                          return (
                            <div key={q.id}>
                              <dt className="text-xs font-medium text-ink">
                                <span className="mr-1.5 font-mono text-ink/40">Q{i + 1}</span>
                                {q.label}
                              </dt>
                              <dd className="mt-0.5 whitespace-pre-line text-sm text-ink/70">
                                {text || <span className="italic text-ink/40">No answer</span>}
                                {fu && (
                                  <span className="mt-1 block border-l-2 border-brand/30 pl-2 text-xs">
                                    <span className="text-ink/50">{fu.question}</span> — {fu.answer}
                                  </span>
                                )}
                              </dd>
                            </div>
                          );
                        })}
                      </dl>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink/45">Click a row to read it in full.</p>
    </div>
  );
}

function HeadCell({ children }: { children: React.ReactNode }) {
  return (
    <th className="sticky top-0 z-10 whitespace-nowrap border-b border-hairline bg-surface px-3 py-2 font-mono text-[10px] font-normal uppercase tracking-wide text-ink/50">
      {children}
    </th>
  );
}

function BodyCell({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <td
      title={title}
      className="max-w-[16rem] truncate border-b border-hairline px-3 py-2 align-top text-ink/80"
    >
      {children}
    </td>
  );
}
