import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import {
  getChoiceConfig,
  getRatingMax,
  isAnswered,
  type Answers,
  type AnswerValue,
} from "@/lib/form-utils";
import { useAuth } from "@/hooks/use-auth";
import { Shell } from "@/components/shell";
import { ClientOnly } from "@/components/client-only";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StarRating, type Question } from "@/components/question-render";

export const Route = createFileRoute("/forms/$formId/responses")({
  component: ResponsesPage,
});

type ResponseRow = {
  id: string;
  submitted_at: string;
  started_at: string | null;
  answers: Answers;
};

function ResponsesPage() {
  const { formId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [responseLimit, setResponseLimit] = useState(100);

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login", search: { redirect: `/forms/${formId}/responses` } });
    }
  }, [loading, user, navigate, formId]);

  const formQ = useQuery({
    enabled: !!user,
    queryKey: ["form", formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forms")
        .select("id, title, user_id")
        .eq("id", formId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const questionsQ = useQuery({
    enabled: !!user,
    queryKey: ["questions", formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("id, form_id, type, label, options, position, required")
        .eq("form_id", formId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Question[];
    },
  });

  const responsesQ = useQuery({
    enabled: !!user,
    queryKey: ["responses", formId, responseLimit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("responses")
        .select("id, submitted_at, started_at, answers")
        .eq("form_id", formId)
        .order("submitted_at", { ascending: false })
        .limit(responseLimit + 1); // fetch one extra to detect if more exist
      if (error) throw error;
      return (data ?? []) as ResponseRow[];
    },
  });

  if (loading || formQ.isLoading) {
    return (
      <Shell width="md">
        <Skeleton className="h-10 w-64" />
      </Shell>
    );
  }

  if (!formQ.data || (user && formQ.data.user_id !== user.id)) {
    return (
      <Shell width="md">
        <h1 className="text-2xl font-bold">Form not found</h1>
        <Link to="/dashboard" className="mt-6 inline-block text-brand underline">
          Back to dashboard
        </Link>
      </Shell>
    );
  }

  const questions = questionsQ.data ?? [];
  const rawResponses = responsesQ.data ?? [];
  const hasMore = rawResponses.length > responseLimit;
  const responses = hasMore ? rawResponses.slice(0, responseLimit) : rawResponses;

  return (
    <Shell width="md">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/60 hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Back to dashboard
      </Link>

      <header className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{formQ.data.title}</h1>
          <p className="mt-1 text-ink/60">
            {hasMore ? `${responses.length}+` : responses.length}{" "}
            {responses.length === 1 && !hasMore ? "response" : "responses"}
          </p>
        </div>
      </header>

      <Tabs defaultValue="overview" className="mt-8">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="individual">Individual responses</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <Overview questions={questions} responses={responses} hasMore={hasMore} />
        </TabsContent>

        <TabsContent value="individual" className="mt-6">
          <IndividualList
            questions={questions}
            responses={responses}
            hasMore={hasMore}
            onLoadMore={() => setResponseLimit((l) => l + 100)}
          />
        </TabsContent>
      </Tabs>
    </Shell>
  );
}

function Overview({
  questions,
  responses,
  hasMore,
}: {
  questions: Question[];
  responses: ResponseRow[];
  hasMore: boolean;
}) {
  const stats = useMemo(() => {
    const total = responses.length;
    const now = Date.now();
    const last7 = responses.filter(
      (r) => now - new Date(r.submitted_at).getTime() <= 7 * 24 * 3600 * 1000,
    ).length;

    const durations = responses
      .filter((r) => r.started_at)
      .map((r) => (new Date(r.submitted_at).getTime() - new Date(r.started_at!).getTime()) / 1000)
      .filter((s) => s > 0 && s < 2 * 3600);
    const avgDuration =
      durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null;

    // NOTE: a true completion rate (views → submits) arrives with funnel
    // analytics; until then every submitted response necessarily answered
    // everything, so we report volume instead of a fake 100% stat.
    const last30 = responses.filter(
      (r) => now - new Date(r.submitted_at).getTime() <= 30 * 24 * 3600 * 1000,
    ).length;
    const avgPerDay = last30 / 30;

    return { total, last7, avgDuration, avgPerDay, durationsCount: durations.length };
  }, [responses]);

  const trend = useMemo(() => buildTrend(responses, 30), [responses]);

  if (responses.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink/15 bg-white/50 p-10 text-center">
        <p className="text-ink/60">
          No responses yet. Share your form to start collecting answers.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total responses" value={String(stats.total)} />
        <StatCard label="Last 7 days" value={String(stats.last7)} />
        <StatCard
          label="Avg time to fill"
          value={stats.avgDuration != null ? formatDuration(stats.avgDuration) : "—"}
          hint={stats.avgDuration == null ? "Not enough data yet" : `${stats.durationsCount} timed`}
        />
        <StatCard
          label="Avg per day"
          value={
            stats.avgPerDay >= 10 ? String(Math.round(stats.avgPerDay)) : stats.avgPerDay.toFixed(1)
          }
          hint="Last 30 days"
        />
      </div>

      {hasMore && (
        <p className="text-xs text-ink/50">
          Stats are based on the most recent {responses.length} responses.
        </p>
      )}

      <Card title="Responses over time" subtitle="Last 30 days">
        <div className="h-56 w-full">
          <ClientOnly fallback={<Skeleton className="h-full w-full" />}>
            <ResponsiveContainer>
              <LineChart data={trend} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="currentColor"
                  className="text-ink/50"
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="currentColor"
                  className="text-ink/50"
                  tick={{ fontSize: 11 }}
                />
                <Tooltip content={<MiniTooltip />} />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ClientOnly>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {questions.map((q) => (
          <QuestionAnalytics key={q.id} question={q} responses={responses} />
        ))}
      </div>
    </div>
  );
}

function QuestionAnalytics({
  question,
  responses,
}: {
  question: Question;
  responses: ResponseRow[];
}) {
  const data = useMemo(() => {
    if (
      question.type === "multiple_choice" ||
      question.type === "dropdown" ||
      question.type === "yes_no"
    ) {
      const opts: string[] =
        question.type === "yes_no" ? ["Yes", "No"] : getChoiceConfig(question.options).choices;
      const counts = new Map<string, number>(opts.map((o) => [o, 0]));
      for (const r of responses) {
        const v = r.answers?.[question.id];
        // choice answers are a string (single) or string[] (multi-select).
        const list: string[] = Array.isArray(v)
          ? v.filter((x): x is string => typeof x === "string")
          : typeof v === "string" && v.length > 0
            ? [v]
            : [];
        for (const item of list) counts.set(item, (counts.get(item) ?? 0) + 1);
      }
      return Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
    }
    if (question.type === "nps") {
      const counts = new Map<number, number>(Array.from({ length: 11 }, (_, i) => [i, 0]));
      let promoters = 0;
      let detractors = 0;
      let answered = 0;
      for (const r of responses) {
        const v = r.answers?.[question.id];
        if (typeof v === "number" && v >= 0 && v <= 10) {
          counts.set(v, (counts.get(v) ?? 0) + 1);
          answered++;
          if (v >= 9) promoters++;
          else if (v <= 6) detractors++;
        }
      }
      const score = answered > 0 ? Math.round(((promoters - detractors) / answered) * 100) : null;
      return {
        bars: Array.from(counts.entries()).map(([name, count]) => ({
          name: String(name),
          count,
        })),
        score,
        answered,
      };
    }
    if (question.type === "rating") {
      const max = getRatingMax(question.options);
      const counts = new Map<number, number>(Array.from({ length: max }, (_, i) => [i + 1, 0]));
      const vals: number[] = [];
      for (const r of responses) {
        const v = r.answers?.[question.id];
        if (typeof v === "number" && v > 0) {
          counts.set(v, (counts.get(v) ?? 0) + 1);
          vals.push(v);
        }
      }
      const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      return {
        bars: Array.from(counts.entries()).map(([name, count]) => ({
          name: `${name}★`,
          count,
        })),
        avg,
      };
    }
    return null;
  }, [question, responses]);

  if (question.type === "text" || question.type === "long_text") {
    const answered = responses.filter((r) => isAnswered(question, r.answers?.[question.id]));
    const recent = answered.slice(0, 5);
    return (
      <Card
        title={question.label || "Untitled question"}
        subtitle={`${answered.length} answered · ${responses.length - answered.length} skipped`}
      >
        {recent.length === 0 ? (
          <p className="text-sm text-ink/40">No answers yet.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-ink/5 bg-surface/50 px-3 py-2 text-sm text-ink/80"
              >
                {truncate(String(r.answers[question.id]), 160)}
              </li>
            ))}
          </ul>
        )}
      </Card>
    );
  }

  if (
    question.type === "multiple_choice" ||
    question.type === "dropdown" ||
    question.type === "yes_no"
  ) {
    const arr = (data as { name: string; count: number }[]) ?? [];
    const subtitle =
      question.type === "yes_no"
        ? "Yes / No"
        : question.type === "dropdown"
          ? "Dropdown"
          : getChoiceConfig(question.options).multi
            ? "Multiple choice · multi-select"
            : "Multiple choice";
    return (
      <Card title={question.label || "Untitled question"} subtitle={subtitle}>
        {arr.length === 0 ? (
          <p className="text-sm text-ink/40">No options.</p>
        ) : (
          <div className="h-56 w-full">
            <ClientOnly fallback={<Skeleton className="h-full w-full" />}>
              <ResponsiveContainer>
                <BarChart
                  data={arr}
                  layout="vertical"
                  margin={{ top: 4, right: 12, left: 8, bottom: 0 }}
                >
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                    stroke="currentColor"
                    className="text-ink/50"
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={{ fontSize: 11 }}
                    stroke="currentColor"
                    className="text-ink/50"
                  />
                  <Tooltip content={<MiniTooltip />} />
                  <Bar dataKey="count" fill="var(--primary)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ClientOnly>
          </div>
        )}
      </Card>
    );
  }

  if (question.type === "nps") {
    const d = data as {
      bars: { name: string; count: number }[];
      score: number | null;
      answered: number;
    };
    return (
      <Card
        title={question.label || "Untitled question"}
        subtitle={
          d.score != null
            ? `NPS ${d.score > 0 ? "+" : ""}${d.score} · ${d.answered} ${d.answered === 1 ? "answer" : "answers"}`
            : "No answers yet"
        }
      >
        <div className="h-56 w-full">
          <ClientOnly fallback={<Skeleton className="h-full w-full" />}>
            <ResponsiveContainer>
              <BarChart data={d.bars} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  stroke="currentColor"
                  className="text-ink/50"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                  stroke="currentColor"
                  className="text-ink/50"
                />
                <Tooltip content={<MiniTooltip />} />
                <Bar dataKey="count" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ClientOnly>
        </div>
      </Card>
    );
  }

  if (question.type === "rating") {
    const d = data as { bars: { name: string; count: number }[]; avg: number | null };
    return (
      <Card
        title={question.label || "Untitled question"}
        subtitle={d.avg != null ? `Average ${d.avg.toFixed(2)}★` : "No ratings yet"}
      >
        <div className="h-56 w-full">
          <ClientOnly fallback={<Skeleton className="h-full w-full" />}>
            <ResponsiveContainer>
              <BarChart data={d.bars} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  stroke="currentColor"
                  className="text-ink/50"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                  stroke="currentColor"
                  className="text-ink/50"
                />
                <Tooltip content={<MiniTooltip />} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {d.bars.map((_, i) => (
                    <Cell key={i} fill="var(--primary)" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ClientOnly>
        </div>
      </Card>
    );
  }

  return null;
}

function IndividualList({
  questions,
  responses,
  hasMore,
  onLoadMore,
}: {
  questions: Question[];
  responses: ResponseRow[];
  hasMore: boolean;
  onLoadMore: () => void;
}) {
  if (responses.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink/15 bg-white/50 p-10 text-center">
        <p className="text-ink/60">No responses yet.</p>
      </div>
    );
  }
  return (
    <>
      <ul className="space-y-4">
        {responses.map((r) => {
          const dur =
            r.started_at != null
              ? (new Date(r.submitted_at).getTime() - new Date(r.started_at).getTime()) / 1000
              : null;
          return (
            <li key={r.id} className="rounded-2xl border border-ink/5 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">
                {new Date(r.submitted_at).toLocaleString()}
                {dur != null && dur > 0 && dur < 2 * 3600 && (
                  <span className="ml-2 text-ink/60 normal-case">
                    · filled in {formatDuration(dur)}
                  </span>
                )}
              </p>
              <dl className="mt-4 space-y-4">
                {questions.map((q) => (
                  <div key={q.id}>
                    <dt className="text-sm font-semibold text-ink">{q.label}</dt>
                    <dd className="mt-1 text-sm text-ink/70">
                      <AnswerView question={q} value={r.answers?.[q.id]} />
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          );
        })}
      </ul>

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={onLoadMore}
            className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-ink/5"
          >
            Load more responses
          </button>
        </div>
      )}
    </>
  );
}

function AnswerView({ question, value }: { question: Question; value: AnswerValue | undefined }) {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  ) {
    return <span className="italic text-ink/40">No answer</span>;
  }
  if (question.type === "rating") {
    return (
      <StarRating max={getRatingMax(question.options)} value={Number(value)} disabled size={18} />
    );
  }
  if (question.type === "nps") {
    return <span>{String(value)} / 10</span>;
  }
  if (Array.isArray(value)) {
    return <span>{value.join(", ")}</span>;
  }
  return <span>{String(value)}</span>;
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-ink/5 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">{label}</p>
      <p className="mt-2 text-2xl font-extrabold tracking-tight text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink/40">{hint}</p>}
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-ink/5 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {subtitle && <p className="text-xs text-ink/50">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function MiniTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-ink/10 bg-white px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium text-ink">{label}</p>
      <p className="text-ink/60">
        {payload[0].value} {payload[0].value === 1 ? "response" : "responses"}
      </p>
    </div>
  );
}

function buildTrend(responses: ResponseRow[], days: number) {
  const buckets = new Map<string, number>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const r of responses) {
    const key = new Date(r.submitted_at).toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets.entries()).map(([key, count]) => {
    const d = new Date(key);
    return {
      key,
      count,
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    };
  });
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return s === 0 ? `${m}m` : `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm === 0 ? `${h}h` : `${h}h ${rm}m`;
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
