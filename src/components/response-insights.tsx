import { Globe, Tag, Trophy, Variable } from "lucide-react";

import { sourceLabel, type QuizOutcome } from "@/lib/form-settings";

/** Shape returned by the `get_form_insights` RPC (jsonb). */
export type FormInsights = {
  sources: { source: string; views: number; submits: number }[];
  campaigns: { campaign: string; submits: number }[];
  hidden: { field: string; value: string; count: number }[];
  quiz: {
    scored: number;
    avg: number | null;
    min: number | null;
    max: number | null;
    outcomes: { outcome: string | null; count: number }[];
    distribution: { score: number; count: number }[];
  } | null;
};

/**
 * Where respondents came from, how each channel converts, what hidden fields
 * carried, and (for quizzes) how people scored. Renders nothing when there's
 * nothing beyond direct traffic and no quiz.
 */
export function ResponseInsights({
  insights,
  outcomes,
  maxScore,
}: {
  insights: FormInsights | null;
  outcomes: QuizOutcome[];
  maxScore: number;
}) {
  if (!insights) return null;
  const sources = insights.sources ?? [];
  const onlyDirect = sources.every((s) => s.source === "direct");
  const hidden = insights.hidden ?? [];
  const quiz = insights.quiz && insights.quiz.scored > 0 ? insights.quiz : null;
  const campaigns = insights.campaigns ?? [];
  if (onlyDirect && hidden.length === 0 && !quiz && campaigns.length === 0) return null;

  const fields = [...new Set(hidden.map((h) => h.field))];

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      {!onlyDirect && sources.length > 0 && (
        <Panel
          icon={Globe}
          title="Traffic sources"
          hint="Views and responses in the selected range"
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink/45">
                <th className="pb-2 font-medium">Source</th>
                <th className="pb-2 text-right font-medium">Views</th>
                <th className="pb-2 text-right font-medium">Responses</th>
                <th className="w-32 pb-2 pl-3 font-medium">Conversion</th>
              </tr>
            </thead>
            <tbody>
              {sources.slice(0, 8).map((s) => {
                // A submit proves a view; floor views so conversion stays ≤ 100%.
                const views = Math.max(s.views, s.submits);
                const rate = views > 0 ? Math.round((s.submits / views) * 100) : null;
                return (
                  <tr key={s.source} className="border-t border-hairline">
                    <td className="max-w-[10rem] truncate py-2 font-medium text-ink">
                      {sourceLabel(s.source)}
                    </td>
                    <td className="py-2 text-right font-mono text-ink/70">{views}</td>
                    <td className="py-2 text-right font-mono text-ink/70">{s.submits}</td>
                    <td className="py-2 pl-3">
                      {rate == null ? (
                        <span className="text-ink/35">—</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-hairline">
                            <div className="h-full bg-brand" style={{ width: `${rate}%` }} />
                          </div>
                          <span className="w-9 text-right font-mono text-xs text-ink/70">
                            {rate}%
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {campaigns.length > 0 && (
            <div className="mt-4 border-t border-hairline pt-3">
              <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-ink/60">
                <Tag className="size-3.5" /> Campaigns
              </p>
              <div className="flex flex-wrap gap-1.5">
                {campaigns.map((c) => (
                  <span
                    key={c.campaign}
                    className="rounded-full border border-hairline bg-surface px-2.5 py-1 text-xs"
                  >
                    {c.campaign} <span className="font-mono text-ink/50">· {c.submits}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </Panel>
      )}

      {quiz && (
        <Panel icon={Trophy} title="Quiz results" hint={`${quiz.scored} scored responses`}>
          <div className="flex items-baseline gap-6">
            <div>
              <p className="font-mono text-3xl font-semibold text-ink">
                {quiz.avg != null ? Math.round(quiz.avg * 10) / 10 : "—"}
                <span className="text-base font-normal text-ink/45"> / {maxScore}</span>
              </p>
              <p className="text-xs text-ink/50">average score</p>
            </div>
            <p className="text-xs text-ink/50">
              range {quiz.min ?? "—"}–{quiz.max ?? "—"}
            </p>
          </div>
          <ScoreHistogram distribution={quiz.distribution} />
          {outcomes.length > 0 && (
            <ul className="mt-4 space-y-1.5 border-t border-hairline pt-3">
              {[...outcomes]
                .sort((a, b) => b.min_score - a.min_score)
                .map((o) => {
                  const n = quiz.outcomes.find((x) => x.outcome === o.id)?.count ?? 0;
                  const pct = quiz.scored > 0 ? Math.round((n / quiz.scored) * 100) : 0;
                  return (
                    <li key={o.id} className="flex items-center gap-3 text-sm">
                      <span className="min-w-0 flex-1 truncate">
                        {o.title}{" "}
                        <span className="font-mono text-[11px] text-ink/40">≥ {o.min_score}</span>
                      </span>
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-hairline">
                        <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-14 text-right font-mono text-xs text-ink/60">
                        {n} · {pct}%
                      </span>
                    </li>
                  );
                })}
            </ul>
          )}
        </Panel>
      )}

      {fields.length > 0 && (
        <Panel icon={Variable} title="Hidden fields" hint="Most common values from the link">
          <div className="space-y-4">
            {fields.map((f) => (
              <div key={f}>
                <p className="font-mono text-xs font-semibold text-ink/70">{f}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {hidden
                    .filter((h) => h.field === f)
                    .map((h) => (
                      <span
                        key={h.value}
                        className="max-w-[14rem] truncate rounded-full border border-hairline bg-surface px-2.5 py-1 text-xs"
                      >
                        {h.value} <span className="font-mono text-ink/50">· {h.count}</span>
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

function ScoreHistogram({ distribution }: { distribution: { score: number; count: number }[] }) {
  if (distribution.length === 0) return null;
  const peak = Math.max(...distribution.map((d) => d.count));
  return (
    <div className="mt-4 flex h-20 items-end gap-1" aria-label="Score distribution">
      {distribution.map((d) => (
        <div key={d.score} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full min-w-1 rounded-t-sm bg-brand/80"
            style={{ height: `${Math.max(6, (d.count / peak) * 64)}px` }}
            title={`${d.count} scored ${d.score}`}
          />
          <span className="font-mono text-[10px] text-ink/45">{d.score}</span>
        </div>
      ))}
    </div>
  );
}

function Panel({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: typeof Globe;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-hairline bg-card p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
          <Icon className="size-4 text-brand" /> {title}
        </h3>
        {hint && <span className="text-xs text-ink/45">{hint}</span>}
      </div>
      {children}
    </section>
  );
}
