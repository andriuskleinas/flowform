import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

type DashboardSummary = {
  days: number;
  total_responses: number;
  responses_window: number;
  responses_prev_window: number;
  views_window: number;
  starts_window: number;
  daily: { day: string; count: number }[];
};

export const RANGES = [
  { days: 7, label: "7D", long: "last 7 days" },
  { days: 30, label: "30D", long: "last 30 days" },
  { days: 90, label: "90D", long: "last 90 days" },
  { days: 365, label: "12M", long: "last 12 months" },
] as const;

/** Below this many views a rate is noise, so it isn't shown. */
const MIN_VIEWS = 5;

const fmt = new Intl.NumberFormat("en");
const pct = (n: number) => `${Math.round(n * 100)}%`;

/** "2026-11-03" → local Date (avoids the UTC shift of `new Date(iso)`). */
function parseDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}
const dayFmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });

/**
 * Workspace performance: the headline numbers for the chosen period, a
 * responses-over-time chart and the view → start → submit funnel. Everything
 * comes from one `get_dashboard_summary` round-trip (server-side aggregation).
 */
export function DashboardAnalytics({ ownerId }: { ownerId: string }) {
  const [days, setDays] = useState<number>(30);
  const range = RANGES.find((r) => r.days === days) ?? RANGES[1];

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["dashboard-summary", ownerId, days],
    staleTime: 0,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dashboard_summary", {
        p_days: days,
        p_owner: ownerId,
      });
      if (error) throw error;
      const s = data as unknown as DashboardSummary;
      return {
        ...s,
        total_responses: Number(s.total_responses),
        responses_window: Number(s.responses_window),
        responses_prev_window: Number(s.responses_prev_window),
        views_window: Number(s.views_window),
        starts_window: Number(s.starts_window),
        daily: (s.daily ?? []).map((d) => ({ day: d.day, count: Number(d.count) })),
      } satisfies DashboardSummary;
    },
  });

  if (isError) return null;

  // Funnel stages can't exceed the stage before them (a response may come
  // from a view in the previous window), so clamp to keep the maths honest.
  const views = data?.views_window ?? 0;
  const starts = Math.min(data?.starts_window ?? 0, views || Infinity);
  const responses = data?.responses_window ?? 0;
  const conversion = views >= MIN_VIEWS ? Math.min(1, responses / views) : null;
  const abandoned = Math.max(0, starts - responses);
  const abandonRate = starts >= MIN_VIEWS ? abandoned / starts : null;

  return (
    <section
      aria-labelledby="performance-heading"
      className="rounded-xl border border-hairline bg-card"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 pb-1 pt-4 md:px-6">
        <div>
          <h2 id="performance-heading" className="text-[15px] font-medium">
            Performance
          </h2>
          <p className="mt-0.5 text-xs text-ink/50">All forms · {range.long}</p>
        </div>
        <div
          role="radiogroup"
          aria-label="Time range"
          className="inline-flex rounded-md border border-hairline bg-surface p-0.5"
        >
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              role="radio"
              aria-checked={days === r.days}
              onClick={() => setDays(r.days)}
              className={
                "min-w-10 rounded px-2.5 py-1 font-mono text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand/40 " +
                (days === r.days ? "bg-card text-ink shadow-sm" : "text-ink/50 hover:text-ink")
              }
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-y-5 px-5 py-5 md:grid-cols-4 md:px-6">
        <Kpi
          label="Responses"
          loading={isLoading}
          value={fmt.format(responses)}
          hint="Submitted forms in this period"
          footer={data && <Delta current={responses} previous={data.responses_prev_window} />}
        />
        <Kpi
          label="Views"
          loading={isLoading}
          value={fmt.format(views)}
          hint="Times a live form was opened"
          footer={<span className="text-ink/45">{fmt.format(starts)} started</span>}
        />
        <Kpi
          label="Conversion"
          loading={isLoading}
          value={conversion === null ? "—" : pct(conversion)}
          hint="Responses ÷ views"
          footer={
            <span className="text-ink/45">
              {conversion === null ? `needs ${MIN_VIEWS}+ views` : "of visitors submit"}
            </span>
          }
        />
        <Kpi
          label="Drop-off"
          loading={isLoading}
          value={abandonRate === null ? "—" : pct(abandonRate)}
          hint="Started answering but never submitted"
          footer={
            <span className="text-ink/45">
              {abandonRate === null
                ? "not enough starts yet"
                : `${fmt.format(abandoned)} left mid-form`}
            </span>
          }
        />
      </dl>

      <div className="grid border-t border-hairline lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="px-5 pb-5 pt-4 md:px-6">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-xs font-medium text-ink/60">
              Responses {data && data.daily.length > 45 ? "per week" : "per day"}
            </h3>
            {data && (
              <span className="font-mono text-[11px] text-ink/45">
                {fmt.format(data.total_responses)} all-time
              </span>
            )}
          </div>
          {isLoading || !data ? (
            <Skeleton className="mt-4 h-36 w-full" />
          ) : (
            <ResponsesChart daily={data.daily} dimmed={isFetching} />
          )}
        </div>

        <div className="border-t border-hairline px-5 pb-5 pt-4 md:px-6 lg:border-l lg:border-t-0">
          <h3 className="text-xs font-medium text-ink/60">Funnel</h3>
          {isLoading || !data ? (
            <Skeleton className="mt-4 h-36 w-full" />
          ) : (
            <Funnel
              views={views}
              starts={starts}
              responses={Math.min(responses, starts || responses)}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function Kpi({
  label,
  value,
  hint,
  footer,
  loading,
}: {
  label: string;
  value: string;
  hint: string;
  footer?: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="min-w-0 pr-4">
      <dt className="text-xs text-ink/55" title={hint}>
        {label}
      </dt>
      <dd>
        {loading ? (
          <Skeleton className="mt-2 h-8 w-20" />
        ) : (
          <p className="mt-1 text-[28px] font-medium leading-tight tabular-nums tracking-tight">
            {value}
          </p>
        )}
        <div className="mt-1 h-4 truncate font-mono text-[11px]">{!loading && footer}</div>
      </dd>
    </div>
  );
}

function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) {
    return (
      <span className="text-ink/45">
        {current === 0 ? "none last period either" : "none in previous period"}
      </span>
    );
  }
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return <span className="text-ink/45">same as previous period</span>;
  const up = change > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={"inline-flex items-center gap-0.5 " + (up ? "text-mint" : "text-coral")}>
      <Icon className="size-3" aria-hidden />
      {up ? "+" : ""}
      {change}%<span className="ml-1 text-ink/45">vs previous</span>
    </span>
  );
}

/** Bar chart with a y-scale, date axis and a hover/focus readout. */
function ResponsesChart({
  daily,
  dimmed,
}: {
  daily: { day: string; count: number }[];
  dimmed: boolean;
}) {
  const weekly = daily.length > 45;
  const buckets = useMemo(() => {
    if (!weekly) {
      return daily.map((d) => {
        const date = parseDay(d.day);
        return {
          key: d.day,
          count: d.count,
          label: dayFmt.format(date),
          short: dayFmt.format(date),
        };
      });
    }
    const out: { key: string; count: number; label: string; short: string }[] = [];
    for (let i = 0; i < daily.length; i += 7) {
      const chunk = daily.slice(i, i + 7);
      const from = parseDay(chunk[0].day);
      const to = parseDay(chunk[chunk.length - 1].day);
      out.push({
        key: chunk[0].day,
        count: chunk.reduce((s, d) => s + d.count, 0),
        label: `${dayFmt.format(from)} – ${dayFmt.format(to)}`,
        short: dayFmt.format(from),
      });
    }
    return out;
  }, [daily, weekly]);

  const [active, setActive] = useState<number | null>(null);
  const total = buckets.reduce((s, b) => s + b.count, 0);
  const peak = Math.max(...buckets.map((b) => b.count), 0);
  // A "nice" ceiling so the axis reads 0 / 2 / 4 rather than 0 / 1.5 / 3.
  const ceiling = peak <= 4 ? 4 : Math.ceil(peak / 4) * 4;
  const shown = active !== null ? buckets[active] : null;
  const tickIdx = [0, Math.floor((buckets.length - 1) / 2), buckets.length - 1];

  return (
    <div className={"mt-3 transition-opacity " + (dimmed ? "opacity-60" : "")}>
      <div className="flex h-5 items-baseline gap-2 font-mono text-[11px]">
        {shown ? (
          <>
            <span className="text-ink">
              {fmt.format(shown.count)} {shown.count === 1 ? "response" : "responses"}
            </span>
            <span className="text-ink/45">{shown.label}</span>
          </>
        ) : (
          <span className="text-ink/45">
            {total > 0 ? `peak ${fmt.format(peak)} · hover for detail` : ""}
          </span>
        )}
      </div>

      <div className="relative mt-1 flex gap-2">
        {/* y-axis */}
        <div className="flex h-32 w-6 shrink-0 flex-col justify-between text-right font-mono text-[10px] leading-none text-ink/35">
          <span>{ceiling}</span>
          <span>{ceiling / 2}</span>
          <span>0</span>
        </div>
        <div className="relative h-32 min-w-0 flex-1">
          {/* gridlines */}
          <div aria-hidden className="absolute inset-0 flex flex-col justify-between">
            <div className="border-t border-dashed border-hairline" />
            <div className="border-t border-dashed border-hairline" />
            <div className="border-t border-hairline" />
          </div>
          <div
            className="relative flex h-full items-end gap-[2px]"
            role="img"
            aria-label={`${total} responses over ${buckets.length} ${weekly ? "weeks" : "days"}`}
            onMouseLeave={() => setActive(null)}
          >
            {buckets.map((b, i) => (
              <div
                key={b.key}
                onMouseEnter={() => setActive(i)}
                className="flex h-full flex-1 items-end"
              >
                <div
                  className={
                    "w-full rounded-t-[2px] transition-colors " +
                    (b.count === 0
                      ? "bg-transparent"
                      : active === i
                        ? "bg-brand"
                        : active === null
                          ? "bg-brand/75"
                          : "bg-brand/35")
                  }
                  style={{ height: b.count > 0 ? `${Math.max(3, (b.count / ceiling) * 100)}%` : 0 }}
                />
              </div>
            ))}
          </div>
          {total === 0 && (
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-xs text-ink/45">
              No responses in this period. Share a live form to start collecting.
            </p>
          )}
        </div>
      </div>

      <div className="ml-8 mt-2 flex justify-between font-mono text-[10px] text-ink/40">
        {tickIdx.map((i, n) => (
          <span key={n}>{buckets[i]?.short}</span>
        ))}
      </div>
    </div>
  );
}

function Funnel({
  views,
  starts,
  responses,
}: {
  views: number;
  starts: number;
  responses: number;
}) {
  const steps = [
    { label: "Viewed", value: views, of: null as number | null },
    { label: "Started", value: starts, of: views },
    { label: "Submitted", value: responses, of: starts },
  ];
  const base = Math.max(views, 1);

  return (
    <ol className="mt-4 space-y-4">
      {steps.map((s) => (
        <li key={s.label}>
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-ink/70">{s.label}</span>
            <span className="font-mono tabular-nums">
              {fmt.format(s.value)}
              {s.of !== null && (
                <span className="ml-1.5 text-ink/40">
                  {s.of > 0 ? pct(Math.min(1, s.value / s.of)) : "—"}
                </span>
              )}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink/[0.06]">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-500"
              style={{ width: `${Math.min(100, (s.value / base) * 100)}%` }}
            />
          </div>
        </li>
      ))}
      <li className="pt-1 text-[11px] leading-relaxed text-ink/45">
        Percentages show how many moved on from the step before.
      </li>
    </ol>
  );
}
