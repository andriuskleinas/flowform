import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, Loader2, Sparkles, Trash2, WandSparkles } from "lucide-react";
import { toast } from "sonner";
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
import { exportResponsesCsv } from "@/lib/export-csv";
import { summarizeResponses, type ResponseSummary } from "@/lib/summarize-responses";
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
import { ConfirmDialog } from "@/components/confirm-dialog";
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

/** Shape returned by the `get_form_analytics` Postgres RPC (jsonb). */
type FormAnalytics = {
  totals: {
    responses: number;
    last7: number;
    avg_fill_seconds: number | null;
    timed_count: number;
  };
  funnel: { views: number; starts: number; submits: number };
  trend: { day: string; count: number }[];
  reach: { question_id: string; count: number }[];
  value_counts: { question_id: string; value: string | null; count: number }[];
};

const RANGE_CHOICES = [7, 30, 90] as const;
type RangeDays = (typeof RANGE_CHOICES)[number];

function ResponsesPage() {
  const { formId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [responseLimit, setResponseLimit] = useState(100);
  const [exporting, setExporting] = useState(false);
  const [days, setDays] = useState<RangeDays>(30);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

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

  // Aggregates over ALL responses + funnel events, computed in Postgres —
  // unlike the capped list above, these numbers never truncate.
  const analyticsQ = useQuery({
    enabled: !!user,
    queryKey: ["form-analytics", formId, days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_form_analytics", {
        p_form_id: formId,
        p_days: days,
      });
      if (error) throw error;
      return data as unknown as FormAnalytics;
    },
  });

  const deleteResponse = useMutation({
    mutationFn: async (responseId: string) => {
      const { error } = await supabase.from("responses").delete().eq("id", responseId);
      if (error) throw error;
    },
    onSuccess: async () => {
      setPendingDelete(null);
      toast.success("Response deleted");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["responses", formId] }),
        qc.invalidateQueries({ queryKey: ["form-analytics", formId] }),
        qc.invalidateQueries({ queryKey: ["dashboard-forms"] }),
      ]);
    },
    onError: (e: Error) => toast.error(e.message || "Could not delete response"),
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
            {(() => {
              const total = analyticsQ.data?.totals.responses ?? responses.length;
              return `${total} ${total === 1 ? "response" : "responses"}`;
            })()}
          </p>
        </div>
        <button
          type="button"
          disabled={exporting || responses.length === 0}
          onClick={async () => {
            setExporting(true);
            try {
              const count = await exportResponsesCsv(formId, formQ.data!.title, questions);
              toast.success(`Exported ${count} ${count === 1 ? "response" : "responses"} to CSV`);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Export failed");
            } finally {
              setExporting(false);
            }
          }}
          className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {exporting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </header>

      <Tabs defaultValue="overview" className="mt-8">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="individual">Individual responses</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <Overview
            formId={formId}
            questions={questions}
            responses={responses}
            analytics={analyticsQ.data ?? null}
            analyticsLoading={analyticsQ.isLoading}
            days={days}
            onDaysChange={setDays}
          />
        </TabsContent>

        <TabsContent value="individual" className="mt-6">
          <IndividualList
            questions={questions}
            responses={responses}
            hasMore={hasMore}
            onLoadMore={() => setResponseLimit((l) => l + 100)}
            onDelete={(id) => setPendingDelete(id)}
          />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this response?"
        description="The response will be permanently removed from your results. This cannot be undone."
        confirmLabel="Delete response"
        destructive
        onConfirm={() => pendingDelete && deleteResponse.mutate(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </Shell>
  );
}

function Overview({
  formId,
  questions,
  responses,
  analytics,
  analyticsLoading,
  days,
  onDaysChange,
}: {
  formId: string;
  questions: Question[];
  responses: ResponseRow[];
  analytics: FormAnalytics | null;
  analyticsLoading: boolean;
  days: RangeDays;
  onDaysChange: (d: RangeDays) => void;
}) {
  const [summary, setSummary] = useState<ResponseSummary | null>(null);
  const summarize = useMutation({
    mutationFn: async () => summarizeResponses({ data: { formId } }),
    onSuccess: setSummary,
    onError: (e: Error) => toast.error(e.message || "Could not summarize responses"),
  });
  const hasTextQuestions = questions.some((q) => q.type === "text" || q.type === "long_text");
  // value → count per question, aggregated server-side over ALL responses.
  const countsByQuestion = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    for (const vc of analytics?.value_counts ?? []) {
      if (vc.value == null) continue;
      let inner = m.get(vc.question_id);
      if (!inner) {
        inner = new Map();
        m.set(vc.question_id, inner);
      }
      inner.set(vc.value, (inner.get(vc.value) ?? 0) + vc.count);
    }
    return m;
  }, [analytics]);

  const reachByQuestion = useMemo(
    () => new Map((analytics?.reach ?? []).map((r) => [r.question_id, r.count])),
    [analytics],
  );

  const trend = useMemo(
    () =>
      (analytics?.trend ?? []).map((t) => ({
        key: t.day,
        count: t.count,
        label: new Date(t.day).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      })),
    [analytics],
  );

  if (analyticsLoading || !analytics) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const { totals, funnel } = analytics;

  if (totals.responses === 0 && funnel.views === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink/15 bg-white/50 p-10 text-center">
        <p className="text-ink/60">
          No responses yet. Share your form to start collecting answers.
        </p>
      </div>
    );
  }

  // A completed submission proves the respondent also viewed and started the
  // form. But view/start events are deduped per IP over 30 min and only exist
  // since funnel tracking shipped, so raw counts can undercount and even show
  // submits > views (e.g. a form's older responses predate tracking, or one
  // person submits twice within the dedup window). Floor each upstream stage
  // at the stage below it so the funnel is always monotonic
  // (Opened ≥ Started ≥ Completed) and every share stays ≤ 100%. In normal
  // traffic (views ≥ starts ≥ submits) these already equal the raw counts, so
  // this only repairs the degenerate case.
  const submitted = funnel.submits;
  const started = Math.max(funnel.starts, submitted);
  const viewed = Math.max(funnel.views, started);

  const completion = viewed > 0 ? Math.round((submitted / viewed) * 100) : null;
  const maxReach = Math.max(0, ...questions.map((q) => reachByQuestion.get(q.id) ?? 0));
  const pctOfViews = (n: number) => (viewed > 0 ? `${Math.round((n / viewed) * 100)}%` : "—");
  // Bar width is the stage's share of the (floored) funnel entry, so the bars
  // narrow monotonically down the funnel.
  const barWidth = (n: number) =>
    `${Math.max(viewed > 0 ? (n / viewed) * 100 : 0, n > 0 ? 6 : 0)}%`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-1">
        {RANGE_CHOICES.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onDaysChange(d)}
            className={
              "rounded-full px-3 py-1 text-xs font-semibold transition-colors " +
              (days === d ? "bg-brand/10 text-brand" : "text-ink/50 hover:bg-ink/5 hover:text-ink")
            }
          >
            {d}d
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total responses" value={String(totals.responses)} hint="All time" />
        <StatCard label="Views" value={String(viewed)} hint={`Last ${days} days`} />
        <StatCard
          label="Completion rate"
          value={completion != null ? `${completion}%` : "—"}
          hint={completion != null ? `Submits ÷ views · last ${days}d` : "No views tracked yet"}
        />
        <StatCard
          label="Avg time to fill"
          value={totals.avg_fill_seconds != null ? formatDuration(totals.avg_fill_seconds) : "—"}
          hint={
            totals.avg_fill_seconds == null ? "Not enough data yet" : `${totals.timed_count} timed`
          }
        />
      </div>

      {hasTextQuestions && (
        <div className="rounded-2xl border border-brand/20 bg-gradient-to-br from-brand/[0.04] to-transparent p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <Sparkles className="size-4 text-brand" />
                AI summary
              </h3>
              <p className="text-xs text-ink/50">
                Claude reads your open-text answers and pulls out themes and sentiment.
              </p>
            </div>
            <button
              type="button"
              onClick={() => summarize.mutate()}
              disabled={summarize.isPending || totals.responses === 0}
              className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-all hover:shadow-lg hover:shadow-brand/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {summarize.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Analyzing…
                </>
              ) : (
                <>
                  <WandSparkles className="size-4" />
                  {summary ? "Refresh summary" : "Summarize with AI"}
                </>
              )}
            </button>
          </div>

          {summary && (
            <div className="mt-4 space-y-4">
              <div className="flex items-start gap-3">
                <span
                  className={
                    "mt-0.5 inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold " +
                    (summary.sentiment === "positive"
                      ? "bg-emerald-100 text-emerald-700"
                      : summary.sentiment === "negative"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700")
                  }
                >
                  {summary.sentiment === "positive"
                    ? "Positive"
                    : summary.sentiment === "negative"
                      ? "Negative"
                      : "Mixed"}
                </span>
                <p className="text-sm leading-relaxed text-ink/80">{summary.summary}</p>
              </div>

              {summary.themes.length > 0 && (
                <ul className="grid gap-2 md:grid-cols-2">
                  {summary.themes.map((t, i) => (
                    <li key={i} className="rounded-xl border border-ink/5 bg-white px-3 py-2.5">
                      <p className="text-sm font-semibold text-ink">{t.name}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-ink/60">{t.detail}</p>
                    </li>
                  ))}
                </ul>
              )}

              {summary.quotes.length > 0 && (
                <div className="space-y-1.5">
                  {summary.quotes.map((q, i) => (
                    <blockquote
                      key={i}
                      className="border-l-2 border-brand/40 pl-3 text-sm italic text-ink/60"
                    >
                      "{q}"
                    </blockquote>
                  ))}
                </div>
              )}

              <p className="text-xs text-ink/40">
                Analyzed {summary.analyzed_count}{" "}
                {summary.analyzed_count === 1 ? "answer" : "answers"} · AI-generated, may contain
                inaccuracies.
              </p>
            </div>
          )}
        </div>
      )}

      <Card title="Funnel" subtitle={`Opened → started → completed · last ${days} days`}>
        <div className="space-y-3">
          {(
            [
              ["Opened", viewed],
              ["Started", started],
              ["Completed", submitted],
            ] as const
          ).map(([label, n]) => (
            <div key={label} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-xs font-semibold text-ink/60">{label}</span>
              <div className="h-6 flex-1 overflow-hidden rounded-md bg-ink/5">
                <div
                  className="flex h-full items-center rounded-md bg-brand/80 px-2 text-xs font-semibold text-brand-foreground transition-all duration-500"
                  style={{ width: barWidth(n) }}
                >
                  {n > 0 ? n : ""}
                </div>
              </div>
              <span className="w-12 shrink-0 text-right text-xs text-ink/50">{pctOfViews(n)}</span>
            </div>
          ))}
          {viewed === 0 && (
            <p className="text-xs text-ink/40">
              Views are tracked from the moment this update shipped — share your form to see the
              funnel fill in.
            </p>
          )}
        </div>
      </Card>

      <Card title="Responses over time" subtitle={`Last ${days} days`}>
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

      <Card
        title="Question drop-off"
        subtitle="How many respondents reached each question (conversational mode)"
      >
        {maxReach === 0 ? (
          <p className="text-sm text-ink/40">
            No data yet — drop-off is measured as respondents move through the conversational form.
          </p>
        ) : (
          <div className="space-y-2">
            {questions.map((q, i) => {
              const n = reachByQuestion.get(q.id) ?? 0;
              return (
                <div key={q.id} className="flex items-center gap-3">
                  <span className="w-8 shrink-0 text-xs font-semibold text-ink/40">Q{i + 1}</span>
                  <div className="h-5 flex-1 overflow-hidden rounded-md bg-ink/5">
                    <div
                      className="h-full rounded-md bg-brand/70 transition-all duration-500"
                      style={{ width: `${(n / maxReach) * 100}%` }}
                    />
                  </div>
                  <span className="w-24 shrink-0 truncate text-xs text-ink/50" title={q.label}>
                    {q.label}
                  </span>
                  <span className="w-10 shrink-0 text-right text-xs font-semibold text-ink/70">
                    {n}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {questions.map((q) => (
          <QuestionAnalytics
            key={q.id}
            question={q}
            responses={responses}
            counts={countsByQuestion.get(q.id) ?? new Map()}
          />
        ))}
      </div>
    </div>
  );
}

function QuestionAnalytics({
  question,
  responses,
  counts,
}: {
  question: Question;
  responses: ResponseRow[];
  /** value → count for this question, aggregated server-side over all responses. */
  counts: Map<string, number>;
}) {
  const data = useMemo(() => {
    if (
      question.type === "multiple_choice" ||
      question.type === "dropdown" ||
      question.type === "yes_no"
    ) {
      const opts: string[] =
        question.type === "yes_no" ? ["Yes", "No"] : getChoiceConfig(question.options).choices;
      return opts.map((name) => ({ name, count: counts.get(name) ?? 0 }));
    }
    if (question.type === "nps") {
      let promoters = 0;
      let detractors = 0;
      let answered = 0;
      const bars = Array.from({ length: 11 }, (_, n) => {
        const count = counts.get(String(n)) ?? 0;
        answered += count;
        if (n >= 9) promoters += count;
        else if (n <= 6) detractors += count;
        return { name: String(n), count };
      });
      const score = answered > 0 ? Math.round(((promoters - detractors) / answered) * 100) : null;
      return { bars, score, answered };
    }
    if (question.type === "rating") {
      const max = getRatingMax(question.options);
      let sum = 0;
      let answered = 0;
      const bars = Array.from({ length: max }, (_, i) => {
        const n = i + 1;
        const count = counts.get(String(n)) ?? 0;
        sum += n * count;
        answered += count;
        return { name: `${n}★`, count };
      });
      const avg = answered > 0 ? sum / answered : null;
      return { bars, avg };
    }
    return null;
  }, [question, counts]);

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
  onDelete,
}: {
  questions: Question[];
  responses: ResponseRow[];
  hasMore: boolean;
  onLoadMore: () => void;
  onDelete: (responseId: string) => void;
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
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">
                  {new Date(r.submitted_at).toLocaleString()}
                  {dur != null && dur > 0 && dur < 2 * 3600 && (
                    <span className="ml-2 text-ink/60 normal-case">
                      · filled in {formatDuration(dur)}
                    </span>
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => onDelete(r.id)}
                  aria-label="Delete response"
                  title="Delete response"
                  className="rounded p-1.5 text-ink/40 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
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
