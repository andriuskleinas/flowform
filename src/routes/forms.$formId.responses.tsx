import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
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
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
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
  answers: Record<string, any>;
};

function ResponsesPage() {
  const { formId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

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
        .select("id, form_id, type, label, options, position")
        .eq("form_id", formId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Question[];
    },
  });

  const responsesQ = useQuery({
    enabled: !!user,
    queryKey: ["responses", formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("responses")
        .select("id, submitted_at, started_at, answers")
        .eq("form_id", formId)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ResponseRow[];
    },
  });

  if (loading || formQ.isLoading) {
    return (
      <Shell>
        <Skeleton className="h-10 w-64" />
      </Shell>
    );
  }

  if (!formQ.data || (user && formQ.data.user_id !== user.id)) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold">Form not found</h1>
        <Link to="/dashboard" className="mt-6 inline-block text-brand underline">
          Back to dashboard
        </Link>
      </Shell>
    );
  }

  const questions = questionsQ.data ?? [];
  const responses = responsesQ.data ?? [];

  return (
    <Shell>
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
            {responses.length} {responses.length === 1 ? "response" : "responses"}
          </p>
        </div>
      </header>

      <Tabs defaultValue="overview" className="mt-8">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="individual">Individual responses</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <Overview questions={questions} responses={responses} />
        </TabsContent>

        <TabsContent value="individual" className="mt-6">
          <IndividualList questions={questions} responses={responses} />
        </TabsContent>
      </Tabs>
    </Shell>
  );
}

function Overview({ questions, responses }: { questions: Question[]; responses: ResponseRow[] }) {
  const stats = useMemo(() => {
    const total = responses.length;
    const now = Date.now();
    const last7 = responses.filter(
      (r) => now - new Date(r.submitted_at).getTime() <= 7 * 24 * 3600 * 1000,
    ).length;

    const durations = responses
      .filter((r) => r.started_at)
      .map(
        (r) => (new Date(r.submitted_at).getTime() - new Date(r.started_at!).getTime()) / 1000,
      )
      .filter((s) => s > 0 && s < 2 * 3600);
    const avgDuration =
      durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null;

    const answeredAll = responses.filter((r) =>
      questions.every((q) => isAnswered(q, r.answers?.[q.id])),
    ).length;
    const completionRate = total > 0 ? Math.round((answeredAll / total) * 100) : 0;

    return { total, last7, avgDuration, completionRate, durationsCount: durations.length };
  }, [questions, responses]);

  const trend = useMemo(() => buildTrend(responses, 30), [responses]);

  if (responses.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink/15 bg-white/50 p-10 text-center">
        <p className="text-ink/60">No responses yet. Share your form to start collecting answers.</p>
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
        <StatCard label="Completion rate" value={`${stats.completionRate}%`} />
      </div>

      <Card title="Responses over time" subtitle="Last 30 days">
        <div className="h-56 w-full">
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
    if (question.type === "multiple_choice") {
      const opts: string[] = Array.isArray(question.options) ? question.options : [];
      const counts = new Map<string, number>(opts.map((o) => [o, 0]));
      for (const r of responses) {
        const v = r.answers?.[question.id];
        const list = Array.isArray(v) ? v : v ? [v] : [];
        for (const item of list) counts.set(item, (counts.get(item) ?? 0) + 1);
      }
      return Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
    }
    if (question.type === "rating") {
      const max = question.options?.max ?? 5;
      const counts = new Map<number, number>(
        Array.from({ length: max }, (_, i) => [i + 1, 0]),
      );
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

  if (question.type === "text") {
    const answered = responses.filter((r) => isAnswered(question, r.answers?.[question.id]));
    const recent = answered.slice(0, 5);
    return (
      <Card title={question.label || "Untitled question"} subtitle={`${answered.length} answered · ${responses.length - answered.length} skipped`}>
        {recent.length === 0 ? (
          <p className="text-sm text-ink/40">No answers yet.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((r) => (
              <li key={r.id} className="rounded-lg border border-ink/5 bg-surface/50 px-3 py-2 text-sm text-ink/80">
                {truncate(String(r.answers[question.id]), 160)}
              </li>
            ))}
          </ul>
        )}
      </Card>
    );
  }

  if (question.type === "multiple_choice") {
    const arr = (data as { name: string; count: number }[]) ?? [];
    return (
      <Card title={question.label || "Untitled question"} subtitle="Multiple choice">
        {arr.length === 0 ? (
          <p className="text-sm text-ink/40">No options.</p>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer>
              <BarChart data={arr} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="currentColor" className="text-ink/50" />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} stroke="currentColor" className="text-ink/50" />
                <Tooltip content={<MiniTooltip />} />
                <Bar dataKey="count" fill="var(--primary)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
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
          <ResponsiveContainer>
            <BarChart data={d.bars} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="currentColor" className="text-ink/50" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="currentColor" className="text-ink/50" />
              <Tooltip content={<MiniTooltip />} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {d.bars.map((_, i) => (
                  <Cell key={i} fill="var(--primary)" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    );
  }

  return null;
}

function IndividualList({
  questions,
  responses,
}: {
  questions: Question[];
  responses: ResponseRow[];
}) {
  if (responses.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink/15 bg-white/50 p-10 text-center">
        <p className="text-ink/60">No responses yet.</p>
      </div>
    );
  }
  return (
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
                <span className="ml-2 text-ink/60 normal-case">· filled in {formatDuration(dur)}</span>
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
  );
}

function AnswerView({ question, value }: { question: Question; value: any }) {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  ) {
    return <span className="italic text-ink/40">No answer</span>;
  }
  if (question.type === "rating") {
    return <StarRating max={question.options?.max ?? 5} value={Number(value)} disabled size={18} />;
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

function MiniTooltip({ active, payload, label }: any) {
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

function isAnswered(q: Question, v: any) {
  if (v === undefined || v === null) return false;
  if (q.type === "text") return typeof v === "string" && v.trim().length > 0;
  if (q.type === "multiple_choice")
    return Array.isArray(v) ? v.length > 0 : typeof v === "string" && v.length > 0;
  if (q.type === "rating") return typeof v === "number" && v > 0;
  return false;
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

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <main className="mx-auto max-w-5xl px-6 py-10 md:px-8 md:py-14">{children}</main>
    </div>
  );
}
