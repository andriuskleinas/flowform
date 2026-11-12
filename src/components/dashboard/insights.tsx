import { Link } from "@tanstack/react-router";
import { ArrowRight, FilePen, Moon, Sparkles, TrendingDown } from "lucide-react";

import type { DashboardForm } from "@/components/dashboard/forms-view";
import { completionRate, type DashboardSearch } from "@/lib/dashboard-filters";

const DAY = 86_400_000;
/** Live forms converting below this share of visitors get flagged. */
const LOW_CONVERSION = 0.3;

type Tone = "positive" | "warning" | "neutral";

type Insight = {
  id: string;
  tone: Tone;
  icon: typeof Sparkles;
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
function deriveInsights(
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
      icon: Sparkles,
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
      icon: TrendingDown,
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
      icon: Moon,
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
      icon: FilePen,
      title: `“${ready[0].title}” is ready to publish`,
      detail: `${plural(ready[0].question_count, "question")} written, not live yet.`,
      action: { kind: "edit", label: "Open draft", formId: ready[0].id },
    });
  } else if (drafts.length > 0) {
    out.push({
      id: "drafts",
      tone: "neutral",
      icon: FilePen,
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
  positive: "bg-mint-tint text-mint",
  warning: "bg-coral-tint text-coral",
  neutral: "bg-ink/[0.05] text-ink/60",
};

export function DashboardInsights({
  forms,
  canEdit,
  onFilter,
}: {
  forms: DashboardForm[];
  canEdit: boolean;
  onFilter: (search: Partial<DashboardSearch>) => void;
}) {
  const insights = deriveInsights(forms, { canEdit });
  if (insights.length === 0) return null;

  return (
    <section aria-labelledby="insights-heading">
      <h2 id="insights-heading" className="sr-only">
        Suggested next steps
      </h2>
      <ul className="grid gap-3 md:grid-cols-3">
        {insights.map((i) => {
          const Icon = i.icon;
          const actionCls =
            "mt-auto inline-flex items-center gap-1 pt-3 text-xs font-medium text-brand outline-none hover:underline focus-visible:underline";
          return (
            <li key={i.id} className="flex flex-col rounded-xl border border-hairline bg-card p-4">
              <div className="flex items-start gap-3">
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-md ${TONE[i.tone]}`}
                >
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-medium leading-snug">{i.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink/55">{i.detail}</p>
                </div>
              </div>
              <div className="pl-10">
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
                ) : i.action.kind === "results" ? (
                  <Link
                    to="/forms/$formId/responses"
                    params={{ formId: i.action.formId }}
                    className={actionCls}
                  >
                    {i.action.label} <ArrowRight className="size-3" />
                  </Link>
                ) : (
                  <Link
                    to="/forms/$formId/edit"
                    params={{ formId: i.action.formId }}
                    className={actionCls}
                  >
                    {i.action.label} <ArrowRight className="size-3" />
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
