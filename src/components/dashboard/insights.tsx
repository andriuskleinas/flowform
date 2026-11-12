import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import type { DashboardForm } from "@/lib/dashboard-forms";
import { completionRate, type DashboardSearch } from "@/lib/dashboard-filters";

const DAY = 86_400_000;
/** Live forms converting below this share of visitors get flagged. */
const LOW_CONVERSION = 0.3;

type Tone = "positive" | "warning" | "neutral";

export type Insight = {
  id: string;
  tone: Tone;
  title: string;
  detail: string;
  action:
    | { kind: "filter"; label: string; search: Partial<DashboardSearch> }
    | { kind: "results"; label: string; formId: string }
    | { kind: "edit"; label: string; formId: string };
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Turns the dashboard rows into a short, prioritised list of things worth
 * doing next. Pure derivation — no extra queries. Returns at most `limit`.
 */
export function deriveInsights(
  forms: DashboardForm[],
  { canEdit = true, limit = 3, now = Date.now() } = {},
): Insight[] {
  const out: Insight[] = [];
  const live = forms.filter((f) => f.status === "published");

  // 1. Momentum — the form doing best this week.
  const hot = [...live].sort((a, b) => b.responses_7d - a.responses_7d)[0];
  if (hot && hot.responses_7d > 0) {
    out.push({
      id: "momentum",
      tone: "positive",
      title: `“${hot.title}” is picking up`,
      detail: `${plural(hot.responses_7d, "response")} in the last 7 days.`,
      action: { kind: "results", label: "See results", formId: hot.id },
    });
  }

  // 2. Low conversion — visitors arrive but don't submit.
  const leaky = live
    .map((f) => ({ f, rate: completionRate(f) }))
    .filter(
      (x): x is { f: DashboardForm; rate: number } => x.rate !== null && x.rate < LOW_CONVERSION,
    )
    .sort((a, b) => b.f.views_90d - a.f.views_90d)[0];
  if (leaky) {
    out.push({
      id: "conversion",
      tone: "warning",
      title: `“${leaky.f.title}” loses most visitors`,
      detail: `Only ${Math.round(leaky.rate * 100)}% of ${leaky.f.views_90d} views became responses. Check where people drop off.`,
      action: { kind: "results", label: "Find the drop-off", formId: leaky.f.id },
    });
  }

  // 3. Quiet — live but nobody has answered for a month (or ever).
  const quiet = live.filter((f) => {
    const last = f.last_response_at ? new Date(f.last_response_at).getTime() : null;
    const age = now - new Date(f.created_at).getTime();
    return last === null ? age > 7 * DAY : now - last > 30 * DAY;
  });
  if (quiet.length > 0) {
    out.push({
      id: "quiet",
      tone: "neutral",
      title: `${plural(quiet.length, "live form")} ${quiet.length === 1 ? "has" : "have"} gone quiet`,
      detail: "No responses in 30+ days. Share the link again, or close what’s no longer needed.",
      action: { kind: "filter", label: "Review", search: { status: undefined, activity: "quiet" } },
    });
  }

  // 4. Drafts — work that isn't collecting anything yet.
  // Viewers can't publish, so drafts aren't something they can act on.
  const drafts = canEdit ? forms.filter((f) => f.status === "draft") : [];
  const ready = drafts.filter((f) => f.question_count > 0);
  if (drafts.length === 1 && ready.length === 1) {
    out.push({
      id: "drafts",
      tone: "neutral",
      title: `“${ready[0].title}” is ready to publish`,
      detail: `${plural(ready[0].question_count, "question")} written, not live yet.`,
      action: { kind: "edit", label: "Open draft", formId: ready[0].id },
    });
  } else if (drafts.length > 0) {
    out.push({
      id: "drafts",
      tone: "neutral",
      title: `${plural(drafts.length, "draft")} not published`,
      detail:
        ready.length === drafts.length
          ? "They have questions, but nobody can answer them yet."
          : `${ready.length} ${ready.length === 1 ? "has" : "have"} questions, ${drafts.length - ready.length} ${drafts.length - ready.length === 1 ? "is" : "are"} still empty.`,
      action: {
        kind: "filter",
        label: "Show drafts",
        search: { status: "draft", activity: undefined },
      },
    });
  }

  return out.slice(0, limit);
}

const TONE: Record<Tone, string> = {
  positive: "bg-mint",
  warning: "bg-coral",
  neutral: "bg-ink/30",
};

/**
 * "Next steps": up to three things worth doing, each with one action.
 * A plain list in one card — a coloured dot carries the tone, the words do
 * the rest.
 */
export function DashboardInsights({
  insights,
  onFilter,
}: {
  insights: Insight[];
  onFilter: (search: Partial<DashboardSearch>) => void;
}) {
  if (insights.length === 0) return null;

  const actionCls =
    "mt-1.5 inline-flex items-center gap-1 rounded text-xs font-medium text-brand outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand/40";

  return (
    <section
      aria-labelledby="insights-heading"
      className="flex min-w-0 flex-col rounded-xl border border-hairline bg-card"
    >
      <h2 id="insights-heading" className="px-5 py-3 text-[15px] font-medium tracking-normal">
        Next steps
      </h2>
      <ul className="grid flex-1 border-t border-hairline sm:grid-cols-3 xl:grid-cols-1">
        {insights.map((i, n) => (
          <li
            key={i.id}
            className={
              "flex gap-3 border-hairline px-5 py-3.5 " +
              (n > 0 ? "border-t sm:border-l sm:border-t-0 xl:border-l-0 xl:border-t" : "")
            }
          >
            <span
              aria-hidden
              className={`mt-[7px] size-1.5 shrink-0 rounded-full ${TONE[i.tone]}`}
            />
            <div className="min-w-0">
              <p className="line-clamp-2 text-[13px] font-medium leading-snug">{i.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-ink/55">{i.detail}</p>
              {i.action.kind === "filter" ? (
                <button
                  type="button"
                  onClick={() =>
                    onFilter((i.action as { search: Partial<DashboardSearch> }).search)
                  }
                  className={actionCls}
                >
                  {i.action.label} <ArrowRight className="size-3" />
                </button>
              ) : (
                <Link
                  to={
                    i.action.kind === "results" ? "/forms/$formId/responses" : "/forms/$formId/edit"
                  }
                  params={{ formId: i.action.formId }}
                  className={actionCls}
                >
                  {i.action.label} <ArrowRight className="size-3" />
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
