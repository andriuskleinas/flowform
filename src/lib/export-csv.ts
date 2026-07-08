import { supabase } from "@/integrations/supabase/client";
import type { Question } from "@/components/question-render";
import type { Answers } from "@/lib/form-utils";

type ExportRow = {
  submitted_at: string;
  started_at: string | null;
  answers: Answers;
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
 * Fetches every response for a form (paged past PostgREST's per-request cap)
 * and triggers a browser download of a UTF-8 CSV: one row per response, one
 * column per question in form order. RLS restricts the fetch to the owner.
 */
export async function exportResponsesCsv(formId: string, formTitle: string, questions: Question[]) {
  const pageSize = 1000;
  const rows: ExportRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("responses")
      .select("submitted_at, started_at, answers")
      .eq("form_id", formId)
      .order("submitted_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as ExportRow[]));
    if (!data || data.length < pageSize) break;
  }

  const header = ["Submitted at", "Fill time (s)", ...questions.map((q) => q.label)];
  const lines = [header.map(csvEscape).join(",")];

  for (const r of rows) {
    const fillSeconds =
      r.started_at != null
        ? Math.round((new Date(r.submitted_at).getTime() - new Date(r.started_at).getTime()) / 1000)
        : null;
    const cells = [
      new Date(r.submitted_at).toISOString(),
      fillSeconds != null && fillSeconds >= 0 ? String(fillSeconds) : "",
      ...questions.map((q) => formatAnswer(r.answers?.[q.id])),
    ];
    lines.push(cells.map(csvEscape).join(","));
  }

  // BOM so Excel opens UTF-8 (accented answers, emoji) correctly.
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const slug =
    formTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "form";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${slug}-responses.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);

  return rows.length;
}
