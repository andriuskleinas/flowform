import { supabase } from "@/integrations/supabase/client";
import type { Question } from "@/components/question-render";
import { parseFollowUps, type Answers } from "@/lib/form-utils";

export type ExportRow = {
  submitted_at: string;
  started_at: string | null;
  answers: Answers;
  follow_ups: unknown;
  form_version: number;
};

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function formatAnswer(value: Answers[string]): string {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.join("; ");
  return String(value);
}

/**
 * Fetches every response for a form (paged past PostgREST's per-request cap),
 * oldest first, optionally limited to one form version. RLS restricts the
 * fetch to workspace members.
 */
export async function fetchAllResponses(formId: string, version: number | null = null) {
  const pageSize = 1000;
  const rows: ExportRow[] = [];
  for (let from = 0; ; from += pageSize) {
    let query = supabase
      .from("responses")
      .select("submitted_at, started_at, answers, follow_ups, form_version")
      .eq("form_id", formId);
    if (version != null) query = query.eq("form_version", version);
    const { data, error } = await query
      .order("submitted_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as ExportRow[]));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

/** A filesystem-safe slug of the form title for download names. */
export function fileSlug(title: string) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "form"
  );
}

export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

/**
 * Triggers a browser download of a UTF-8 CSV: one row per response, one
 * column per question in form order.
 */
export async function exportResponsesCsv(
  formId: string,
  formTitle: string,
  questions: Question[],
  version: number | null = null,
) {
  const rows = await fetchAllResponses(formId, version);

  // Questions with follow-ups (enabled now, or present in older responses)
  // get two extra columns right after their answer column.
  const parsed = rows.map((r) => parseFollowUps(r.follow_ups));
  const withFollowUps = new Set(questions.filter((q) => q.ai_follow_up).map((q) => q.id));
  for (const f of parsed) for (const qid of Object.keys(f)) withFollowUps.add(qid);

  const header = [
    "Submitted at",
    "Version",
    "Fill time (s)",
    ...questions.flatMap((q) =>
      withFollowUps.has(q.id)
        ? [q.label, `${q.label} — AI follow-up`, `${q.label} — follow-up answer`]
        : [q.label],
    ),
  ];
  const lines = [header.map(csvEscape).join(",")];

  for (const [i, r] of rows.entries()) {
    const fillSeconds =
      r.started_at != null
        ? Math.round((new Date(r.submitted_at).getTime() - new Date(r.started_at).getTime()) / 1000)
        : null;
    const cells = [
      new Date(r.submitted_at).toISOString(),
      `v${r.form_version}`,
      fillSeconds != null && fillSeconds >= 0 ? String(fillSeconds) : "",
      ...questions.flatMap((q) => {
        const answer = formatAnswer(r.answers?.[q.id]);
        if (!withFollowUps.has(q.id)) return [answer];
        const fu = parsed[i][q.id];
        return [answer, fu?.question ?? "", fu?.answer ?? ""];
      }),
    ];
    lines.push(cells.map(csvEscape).join(","));
  }

  // BOM so Excel opens UTF-8 (accented answers, emoji) correctly.
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `${fileSlug(formTitle)}-responses.csv`);

  return rows.length;
}
