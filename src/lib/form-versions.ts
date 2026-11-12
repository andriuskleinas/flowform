import type { Question } from "@/components/question-render";
import { questionOptionsEqual } from "@/lib/form-utils";

/** One entry of the `get_form_versions` RPC (jsonb), newest first. */
export type FormVersion = {
  version: number;
  is_current: boolean;
  title: string;
  questions: Question[];
  started_at: string;
  ended_at: string | null;
  responses: number;
  last_response_at: string | null;
  avg_fill_seconds: number | null;
  views: number;
  starts: number;
};

export function parseVersions(formId: string, raw: unknown): FormVersion[] {
  if (!Array.isArray(raw)) return [];
  return (raw as FormVersion[]).map((v) => ({
    ...v,
    questions: (Array.isArray(v.questions) ? v.questions : []).map((q) => ({
      ...q,
      form_id: formId,
    })),
  }));
}

/**
 * Completion = submits ÷ views, with views floored at submits: a submit proves
 * a view happened, and older responses predate funnel tracking.
 */
export function versionCompletion(v: FormVersion): number | null {
  const viewed = Math.max(v.views, v.starts, v.responses);
  return viewed > 0 ? Math.round((v.responses / viewed) * 100) : null;
}

export type QuestionDiff = { added: number; removed: number; changed: number };

/** What changed going from `prev` to `next`, matched by question id. */
export function diffQuestions(prev: Question[], next: Question[]): QuestionDiff {
  const before = new Map(prev.map((q) => [q.id, q]));
  const afterIds = new Set(next.map((q) => q.id));
  let added = 0;
  let changed = 0;
  for (const q of next) {
    const old = before.get(q.id);
    if (!old) added++;
    else if (
      old.label.trim() !== q.label.trim() ||
      old.type !== q.type ||
      old.required !== q.required ||
      !questionOptionsEqual(old.options, q.options)
    )
      changed++;
  }
  const removed = prev.filter((q) => !afterIds.has(q.id)).length;
  return { added, removed, changed };
}

/**
 * Questions to show results for. A single version uses its own snapshot; "all
 * versions" uses the current questions followed by any that earlier versions
 * asked but the current one dropped, so their answers stay visible.
 */
export function questionsForView(
  versions: FormVersion[],
  current: Question[],
  selected: number | null,
): Question[] {
  if (selected != null) {
    const v = versions.find((x) => x.version === selected);
    if (v && !v.is_current) return v.questions;
    return current;
  }
  const seen = new Set(current.map((q) => q.id));
  const retired: Question[] = [];
  for (const v of versions) {
    if (v.is_current) continue;
    for (const q of v.questions) {
      if (seen.has(q.id)) continue;
      seen.add(q.id);
      retired.push({ ...q, label: `${q.label} (v${v.version})` });
    }
  }
  return [...current, ...retired].map((q, i) => ({ ...q, position: i }));
}
