import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import type { FormStatus } from "@/lib/form-utils";

type SummaryForm = {
  id: string;
  title: string;
  status: FormStatus;
  response_count: number;
};

type DashboardSummary = {
  days: number;
  total_responses: number;
  responses_window: number;
  responses_prev_window: number;
  views_window: number;
  starts_window: number;
  daily: { day: string; count: number }[];
};

const RANGES = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
  { days: 365, label: "1y" },
] as const;

const fmt = new Intl.NumberFormat("en");

/**
 * Workspace-wide analytics strip above the forms list. Response/view numbers
 * come from the `get_dashboard_summary` RPC (one round-trip, server-side
 * aggregation); form status counts and the top form are derived from the
 * already-loaded dashboard rows.
 */
export function DashboardSummaryPanel({
  userId,
  forms,
  formsLoading,
}: {
  userId: string;
  forms: SummaryForm[];
  formsLoading: boolean;
}) {
  const [days, setDays] = useState<number>(30);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard-summary", userId, days],
    staleTime: 0,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dashboard_summary", {
        p_days: days,
        p_owner: userId,
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

  const statusCounts = useMemo(() => {
    const c = { published: 0, draft: 0, closed: 0 };
    for (const f of forms) c[f.status] = (c[f.status] ?? 0) + 1;
    return c;
  }, [forms]);

  const topForm = useMemo(
    () =>
      forms.reduce<SummaryForm | null>(
        (best, f) => (f.response_count > (best?.response_count ?? 0) ? f : best),
        null,
      ),
    [forms],
  );

  const rangeLabel = days === 365 ? "last 12 months" : `last ${days} days`;
  const completion =
    data && data.views_window > 0
      ? Math.min(100, Math.round((data.responses_window / data.views_window) * 100))
      : null;

  if (isError) return null;

  return (
    <section
      aria-labelledby="overview-heading"
      className="mt-10 rounded-lg border border-hairline bg-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-3.5">
        <div className="flex items-baseline gap-3">
          <h2 id="overview-heading" className="text-[15px] font-medium tracking-normal">
            Overview
          </h2>
          <span className="font-mono text-xs text-ink/45">{rangeLabel}</span>
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
                "rounded px-2.5 py-1 font-mono text-[11px] transition-colors " +
                (days === r.days ? "bg-card text-ink shadow-sm" : "text-ink/55 hover:text-ink")
              }
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-hairline md:grid-cols-4">
        <Stat
          label="Responses"
          loading={isLoading}
          value={data ? fmt.format(data.responses_window) : "—"}
          footer={
            data ? (
              <Delta current={data.responses_window} previous={data.responses_prev_window} />
            ) : null
          }
        />
        <Stat
          label="Views"
          loading={isLoading}
          value={data ? fmt.format(data.views_window) : "—"}
          footer={
            data ? (
              <span className="text-ink/45">{fmt.format(data.starts_window)} started</span>
            ) : null
          }
        />
        <Stat
          label="Completion"
          loading={isLoading}
          value={completion === null ? "—" : `${completion}%`}
          footer={<span className="text-ink/45">responses ÷ views</span>}
        />
        <Stat
          label="Live forms"
          loading={formsLoading}
          value={`${statusCounts.published}`}
          suffix={`/ ${forms.length}`}
          footer={
            <span className="text-ink/45">
              {statusCounts.draft} draft · {statusCounts.closed} closed
            </span>
          }
        />
      </div>

      <div className="border-t border-hairline px-5 pb-4 pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs font-medium text-ink/60">Responses per day</p>
          <p className="truncate font-mono text-[11px] text-ink/45">
            {data ? `${fmt.format(data.total_responses)} all-time` : ""}
            {topForm ? ` · top: ${topForm.title} (${fmt.format(topForm.response_count)})` : ""}
          </p>
        </div>
        {isLoading || !data ? (
          <Skeleton className="mt-3 h-14 w-full" />
        ) : (
          <Sparkbars daily={data.daily} />
        )}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  suffix,
  footer,
  loading,
}: {
  label: string;
  value: string;
  suffix?: string;
  footer?: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="bg-card px-5 py-4">
      <p className="text-xs font-medium text-ink/60">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-16" />
      ) : (
        <p className="mt-1.5 text-2xl font-medium tabular-nums tracking-tight">
          {value}
          {suffix && <span className="ml-1 text-base text-ink/40">{suffix}</span>}
        </p>
      )}
      <div className="mt-1 h-4 font-mono text-[11px]">{!loading && footer}</div>
    </div>
  );
}

function Delta({ current, previous }: { current: number; previous: number }) {
  if (current === 0 && previous === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-ink/45">
        <Minus className="size-3" /> no change
      </span>
    );
  }
  if (previous === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-700">
        <ArrowUpRight className="size-3" /> new activity
      </span>
    );
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  const up = pct >= 0;
  const Icon = pct === 0 ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={
        "inline-flex items-center gap-1 " +
        (pct === 0 ? "text-ink/45" : up ? "text-emerald-700" : "text-rose-700")
      }
    >
      <Icon className="size-3" />
      {up && pct > 0 ? "+" : ""}
      {pct}% vs prev.
    </span>
  );
}

/** Minimal daily bar chart; long ranges are bucketed weekly to stay legible. */
function Sparkbars({ daily }: { daily: { day: string; count: number }[] }) {
  const buckets = useMemo(() => {
    if (daily.length <= 45) return daily.map((d) => ({ label: d.day, count: d.count }));
    const out: { label: string; count: number }[] = [];
    for (let i = 0; i < daily.length; i += 7) {
      const chunk = daily.slice(i, i + 7);
      out.push({
        label: `${chunk[0].day} – ${chunk[chunk.length - 1].day}`,
        count: chunk.reduce((s, d) => s + d.count, 0),
      });
    }
    return out;
  }, [daily]);

  const max = Math.max(1, ...buckets.map((b) => b.count));
  const total = buckets.reduce((s, b) => s + b.count, 0);

  return (
    <div className="relative mt-3">
      <div
        className="flex h-14 items-end gap-[2px]"
        role="img"
        aria-label={`${total} responses across ${buckets.length} ${
          daily.length > 45 ? "weeks" : "days"
        }`}
      >
        {buckets.map((b) => (
          <div
            key={b.label}
            title={`${b.label}: ${b.count} ${b.count === 1 ? "response" : "responses"}`}
            className="group flex h-full flex-1 items-end"
          >
            <div
              className={
                "w-full rounded-[2px] transition-colors " +
                (b.count > 0 ? "bg-brand/80 group-hover:bg-brand" : "bg-ink/[0.06]")
              }
              style={{ height: b.count > 0 ? `${Math.max(8, (b.count / max) * 100)}%` : "3px" }}
            />
          </div>
        ))}
      </div>
      {total === 0 && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-ink/45">
          No responses in this period — share a live form to start collecting.
        </p>
      )}
    </div>
  );
}
