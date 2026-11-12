import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "react-qr-code";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspaceRole } from "@/lib/workspace";
import { getChoiceConfig, getRatingMax, type Answers } from "@/lib/form-utils";
import type { Question } from "@/components/question-render";
import { LogoMark } from "@/components/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { recallText } from "@/lib/form-settings";

export const Route = createFileRoute("/forms/$formId/live")({
  component: LivePage,
  head: () => ({ meta: [{ title: "Live results — Flowform" }] }),
});

/** Subset of the `get_form_analytics` RPC this page reads. */
type LiveAnalytics = {
  totals: { responses: number };
  value_counts: { question_id: string; value: string | null; count: number }[];
};

type RecentResponse = { id: string; submitted_at: string; answers: Answers };

const AUTO_ADVANCE_MS = 12_000;

function LivePage() {
  const { formId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user)
      navigate({ to: "/login", search: { redirect: `/forms/${formId}/live` } });
  }, [loading, user, navigate, formId]);

  if (loading || !user) return <LiveSkeleton />;
  return <LiveAuthed formId={formId} userId={user.id} />;
}

function LiveSkeleton() {
  return (
    <div className="min-h-screen bg-paper p-6 md:p-10">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="mt-10 h-[60vh] w-full rounded-2xl" />
    </div>
  );
}

function LiveAuthed({ formId, userId }: { formId: string; userId: string }) {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [slide, setSlide] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pulse, setPulse] = useState(0);
  const [origin, setOrigin] = useState("");
  // Hide the running total (e.g. while a vote is open, to avoid herding).
  const [showCount, setShowCount] = useState(true);
  // Pin the current question: no auto-advance, arrows and dots disabled.
  const [locked, setLocked] = useState(false);

  useEffect(() => setOrigin(window.location.origin), []);

  // Own query keys: other pages cache the form/questions with different selects.
  const formQ = useQuery({
    queryKey: ["live-form", formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forms")
        .select("id, title, user_id, status, version")
        .eq("id", formId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const version = formQ.data?.version;

  const questionsQ = useQuery({
    queryKey: ["live-questions", formId],
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

  // Realtime is the main signal; polling is the safety net if the socket drops.
  const pollMs = connected ? 60_000 : 10_000;

  // Scoped to the version that's collecting now, so an updated survey's live
  // view isn't mixed with answers to its earlier questions.
  const analyticsQ = useQuery({
    queryKey: ["live-analytics", formId, version],
    enabled: version != null,
    refetchInterval: pollMs,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_form_analytics", {
        p_form_id: formId,
        p_days: 365,
        p_version: version!,
      });
      if (error) throw error;
      return data as unknown as LiveAnalytics;
    },
  });

  const recentQ = useQuery({
    queryKey: ["live-recent", formId, version],
    enabled: version != null,
    refetchInterval: pollMs,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("responses")
        .select("id, submitted_at, answers")
        .eq("form_id", formId)
        .eq("form_version", version!)
        .order("submitted_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data ?? []) as RecentResponse[];
    },
  });

  const { role, isLoading: roleLoading } = useWorkspaceRole(userId, formQ.data?.user_id);

  // New responses arrive over Realtime; RLS means only workspace members
  // receive them. Bursts are coalesced into one refetch.
  useEffect(() => {
    if (!role) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel(`live-responses:${formId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "responses", filter: `form_id=eq.${formId}` },
        () => {
          setPulse((p) => p + 1);
          clearTimeout(timer);
          timer = setTimeout(() => {
            qc.invalidateQueries({ queryKey: ["live-analytics", formId] });
            qc.invalidateQueries({ queryKey: ["live-recent", formId] });
          }, 400);
        },
      )
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [formId, role, qc]);

  const questions = useMemo(() => questionsQ.data ?? [], [questionsQ.data]);
  const total = questions.length;
  const current = questions[Math.min(slide, Math.max(total - 1, 0))];

  const go = useCallback(
    (delta: number) => setSlide((s) => (total === 0 ? 0 : (s + delta + total) % total)),
    [total],
  );

  // Auto-advance for an unattended screen (never while pinned to a question).
  useEffect(() => {
    if (!playing || locked || total < 2) return;
    const t = setInterval(() => go(1), AUTO_ADVANCE_MS);
    return () => clearInterval(t);
  }, [playing, locked, total, go]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Presenter clickers send arrow / page keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (["ArrowRight", "PageDown"].includes(e.key)) {
        if (!locked) go(1);
      } else if (["ArrowLeft", "PageUp"].includes(e.key)) {
        if (!locked) go(-1);
      } else if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (key === "f") toggleFullscreen();
      else if (key === "c") setShowCount((v) => !v);
      else if (key === "l") setLocked((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, locked, toggleFullscreen]);

  // Short /f/<code> link for the join card, used only when it resolves
  // unambiguously to this survey; otherwise fall back to the full URL.
  const shortCode = formId.slice(0, 8).toLowerCase();
  const shortLinkQ = useQuery({
    queryKey: ["live-short-link", formId, formQ.data?.status],
    enabled: formQ.data?.status === "published",
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("resolve_short_form_link", {
        p_code: shortCode,
      });
      if (error) return false;
      return data === formId;
    },
  });

  const countsByQuestion = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    for (const vc of analyticsQ.data?.value_counts ?? []) {
      if (vc.value == null) continue;
      const inner = m.get(vc.question_id) ?? new Map<string, number>();
      inner.set(vc.value, (inner.get(vc.value) ?? 0) + vc.count);
      m.set(vc.question_id, inner);
    }
    return m;
  }, [analyticsQ.data]);

  if (formQ.isLoading || questionsQ.isLoading || (formQ.data && roleLoading)) {
    return <LiveSkeleton />;
  }

  if (!formQ.data || !role) {
    return (
      <div className="min-h-screen bg-paper px-4 py-16 text-center">
        <h1 className="font-display text-3xl text-ink">Form not found</h1>
        <Link to="/dashboard" className="mt-6 inline-block text-brand underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const form = formQ.data;
  const responses = analyticsQ.data?.totals.responses ?? 0;
  const formUrl = !origin
    ? ""
    : shortLinkQ.data
      ? `${origin}/f/${shortCode}`
      : `${origin}/forms/${form.id}`;
  const accepting = form.status === "published";

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      {/* Top bar */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3 md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <LogoMark className="size-7 shrink-0" />
          <h1 className="truncate font-display text-lg md:text-xl">{form.title}</h1>
          <LiveBadge connected={connected} accepting={accepting} />
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            label={showCount ? "Hide response count (C)" : "Show response count (C)"}
            pressed={!showCount}
            onClick={() => setShowCount((v) => !v)}
          >
            {showCount ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </IconButton>
          {total > 1 && (
            <IconButton
              label={locked ? "Unlock question (L)" : "Stay on this question (L)"}
              pressed={locked}
              onClick={() => setLocked((v) => !v)}
            >
              {locked ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
            </IconButton>
          )}
          {total > 1 && !locked && (
            <IconButton
              label={playing ? "Pause auto-advance (Space)" : "Auto-advance (Space)"}
              pressed={playing}
              onClick={() => setPlaying((p) => !p)}
            >
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </IconButton>
          )}
          <IconButton
            label={isFullscreen ? "Exit full screen (F)" : "Full screen (F)"}
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </IconButton>
          <Link
            to="/forms/$formId/responses"
            params={{ formId }}
            aria-label="Exit live view"
            title="Exit live view"
            className="inline-flex size-9 items-center justify-center rounded-md text-ink/60 hover:bg-ink/5 hover:text-ink"
          >
            <X className="size-4" />
          </Link>
        </div>
      </header>

      {!accepting && (
        <p className="border-b border-hairline bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-800 dark:text-amber-300">
          This form isn’t taking responses. Publish or reopen it to collect live answers.
        </p>
      )}

      {/* Stage */}
      <main className="relative flex flex-1 flex-col px-4 pb-6 pt-6 md:px-10 md:pt-10">
        <div className="flex items-start justify-between gap-4 md:gap-8">
          <div className="min-w-0 flex-1">
            {total > 0 && (
              <p className="font-mono text-xs uppercase tracking-wide text-ink/45">
                Question {Math.min(slide, total - 1) + 1} of {total}
              </p>
            )}
            <h2 className="mt-2 max-w-4xl font-display text-3xl leading-tight md:text-5xl">
              {current
                ? recallText(current.label, {}) // no respondent here: drop {placeholders}
                : "This form has no questions yet"}
            </h2>
          </div>
          {showCount && <ResponseCounter count={responses} pulse={pulse} />}
        </div>

        <div className="mt-8 flex-1 md:mt-12 md:pr-56">
          {current && (
            <QuestionResult
              key={current.id}
              question={current}
              counts={countsByQuestion.get(current.id) ?? new Map()}
              recent={recentQ.data ?? []}
            />
          )}
        </div>

        {/* Slide controls */}
        {total > 1 && locked && (
          <button
            type="button"
            onClick={() => setLocked(false)}
            className="mt-8 inline-flex items-center gap-1.5 self-start rounded-full border border-hairline px-3 py-1 font-mono text-[11px] uppercase tracking-wide text-ink/50 hover:text-ink"
          >
            <Lock className="size-3" /> Staying on this question · L to unlock
          </button>
        )}
        {total > 1 && !locked && (
          <nav className="mt-8 flex items-center gap-3" aria-label="Questions">
            <IconButton label="Previous question (←)" onClick={() => go(-1)}>
              <ChevronLeft className="size-5" />
            </IconButton>
            <div className="flex flex-wrap gap-1.5">
              {questions.map((q, i) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setSlide(i)}
                  aria-label={`Question ${i + 1}`}
                  aria-current={i === slide}
                  className={
                    "h-1.5 rounded-full transition-all " +
                    (i === slide ? "w-8 bg-brand" : "w-3 bg-ink/15 hover:bg-ink/30")
                  }
                />
              ))}
            </div>
            <IconButton label="Next question (→)" onClick={() => go(1)}>
              <ChevronRight className="size-5" />
            </IconButton>
          </nav>
        )}

        {/* Join card */}
        {accepting && formUrl && (
          <aside className="mt-8 flex items-center gap-4 self-start rounded-xl border border-hairline bg-card p-4 md:absolute md:bottom-8 md:right-10 md:mt-0 md:flex-col md:items-center md:gap-3 md:p-5">
            <div className="rounded-md bg-white p-2">
              <QRCode value={formUrl} size={136} aria-label="QR code to answer this form" />
            </div>
            <div className="md:text-center">
              <p className="text-sm font-semibold">Scan to answer</p>
              <p className="mt-0.5 max-w-[11rem] break-all font-mono text-[11px] text-ink/50">
                {formUrl.replace(/^https?:\/\//, "")}
              </p>
            </div>
          </aside>
        )}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

function LiveBadge({ connected, accepting }: { connected: boolean; accepting: boolean }) {
  const live = connected && accepting;
  return (
    <span
      title={connected ? "Updating in real time" : "Reconnecting. Refreshing every few seconds…"}
      className={
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide " +
        (live
          ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
          : "border-hairline text-ink/50")
      }
    >
      <span className="relative flex size-2">
        {live && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
        )}
        <span
          className={
            "relative inline-flex size-2 rounded-full " + (live ? "bg-emerald-500" : "bg-ink/30")
          }
        />
      </span>
      {live ? "Live" : connected ? "Paused" : "Connecting"}
    </span>
  );
}

function ResponseCounter({ count, pulse }: { count: number; pulse: number }) {
  // Re-keying on each new response replays the bump animation.
  return (
    <div className="shrink-0 text-right">
      <p
        key={pulse}
        className={
          "font-mono text-5xl font-medium tabular-nums tracking-tight md:text-7xl " +
          (pulse > 0 ? "animate-[live-bump_600ms_ease-out]" : "")
        }
      >
        {count}
      </p>
      <p className="font-mono text-xs uppercase tracking-wide text-ink/45">
        {count === 1 ? "response" : "responses"}
      </p>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  /** For toggles: rendered as aria-pressed and highlighted while on. */
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={
        "inline-flex size-9 items-center justify-center rounded-md hover:bg-ink/5 hover:text-ink " +
        (pressed ? "bg-ink/[0.07] text-ink" : "text-ink/60")
      }
    >
      {children}
    </button>
  );
}

/* ------------------------------ Per-type views ----------------------------- */

function QuestionResult({
  question,
  counts,
  recent,
}: {
  question: Question;
  counts: Map<string, number>;
  recent: RecentResponse[];
}) {
  switch (question.type) {
    case "multiple_choice":
    case "dropdown":
      return (
        <ChoiceBars
          rows={getChoiceConfig(question.options).choices.map((c) => ({
            label: c,
            count: counts.get(c) ?? 0,
          }))}
          note={
            getChoiceConfig(question.options).multi ? "People could pick more than one" : undefined
          }
        />
      );
    case "yes_no":
      return <YesNoSplit yes={counts.get("Yes") ?? 0} no={counts.get("No") ?? 0} />;
    case "rating":
      return <RatingColumns max={getRatingMax(question.options)} counts={counts} />;
    case "nps":
      return <NpsView counts={counts} />;
    case "text":
    case "long_text":
      return <AnswerWall question={question} recent={recent} />;
    default:
      return null;
  }
}

function ChoiceBars({ rows, note }: { rows: { label: string; count: number }[]; note?: string }) {
  const sum = rows.reduce((a, r) => a + r.count, 0);
  const max = Math.max(1, ...rows.map((r) => r.count));
  const lead = sum > 0 ? Math.max(...rows.map((r) => r.count)) : -1;
  return (
    <div>
      <ul className="space-y-4 md:space-y-5">
        {rows.map((r) => {
          const pct = sum > 0 ? Math.round((r.count / sum) * 100) : 0;
          return (
            <li key={r.label}>
              <div className="mb-1.5 flex items-baseline justify-between gap-4">
                <span className="text-lg font-medium md:text-2xl">{r.label}</span>
                <span className="shrink-0 font-mono text-sm tabular-nums text-ink/60 md:text-lg">
                  {pct}% <span className="text-ink/35">· {r.count}</span>
                </span>
              </div>
              <div className="h-4 overflow-hidden rounded-full bg-ink/[0.06] md:h-6">
                <div
                  className={
                    "h-full rounded-full transition-[width] duration-700 ease-out " +
                    (r.count === lead ? "bg-brand" : "bg-brand/40")
                  }
                  style={{ width: `${(r.count / max) * 100}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {note && <p className="mt-4 text-sm text-ink/45">{note}</p>}
      {sum === 0 && <EmptyNote />}
    </div>
  );
}

function YesNoSplit({ yes, no }: { yes: number; no: number }) {
  const sum = yes + no;
  const yesPct = sum > 0 ? Math.round((yes / sum) * 100) : 50;
  return (
    <div>
      <div className="flex items-end justify-between">
        <Big value={sum > 0 ? `${yesPct}%` : "—"} label={`Yes · ${yes}`} />
        <Big value={sum > 0 ? `${100 - yesPct}%` : "—"} label={`No · ${no}`} align="right" />
      </div>
      <div className="mt-5 flex h-8 overflow-hidden rounded-full bg-ink/[0.06] md:h-10">
        <div
          className="h-full bg-brand transition-[width] duration-700 ease-out"
          style={{ width: sum > 0 ? `${yesPct}%` : "0%" }}
        />
        <div
          className="h-full bg-ink/25 transition-[width] duration-700 ease-out"
          style={{ width: sum > 0 ? `${100 - yesPct}%` : "0%" }}
        />
      </div>
      {sum === 0 && <EmptyNote />}
    </div>
  );
}

function RatingColumns({ max, counts }: { max: number; counts: Map<string, number> }) {
  const cols = Array.from({ length: max }, (_, i) => ({
    label: `${i + 1}★`,
    n: i + 1,
    count: counts.get(String(i + 1)) ?? 0,
  }));
  const answered = cols.reduce((a, c) => a + c.count, 0);
  const avg = answered > 0 ? cols.reduce((a, c) => a + c.n * c.count, 0) / answered : null;
  return (
    <div className="flex flex-col gap-8 md:flex-row md:items-end">
      <Big value={avg != null ? `${avg.toFixed(1)}★` : "—"} label={`average of ${answered}`} />
      <Columns cols={cols} highlight={(c) => avg != null && Math.round(avg) === c.n} />
    </div>
  );
}

function NpsView({ counts }: { counts: Map<string, number> }) {
  const cols = Array.from({ length: 11 }, (_, n) => ({
    label: String(n),
    n,
    count: counts.get(String(n)) ?? 0,
  }));
  const answered = cols.reduce((a, c) => a + c.count, 0);
  const promoters = cols.filter((c) => c.n >= 9).reduce((a, c) => a + c.count, 0);
  const detractors = cols.filter((c) => c.n <= 6).reduce((a, c) => a + c.count, 0);
  const score = answered > 0 ? Math.round(((promoters - detractors) / answered) * 100) : null;
  return (
    <div className="flex flex-col gap-8 md:flex-row md:items-end">
      <Big
        value={score != null ? `${score > 0 ? "+" : ""}${score}` : "—"}
        label={`NPS · ${answered} ${answered === 1 ? "answer" : "answers"}`}
      />
      <Columns
        cols={cols}
        tone={(c) => (c.n >= 9 ? "bg-emerald-500" : c.n <= 6 ? "bg-rose-500/70" : "bg-ink/25")}
      />
    </div>
  );
}

type Col = { label: string; n: number; count: number };

function Columns({
  cols,
  highlight,
  tone,
}: {
  cols: Col[];
  highlight?: (c: Col) => boolean;
  tone?: (c: Col) => string;
}) {
  const max = Math.max(1, ...cols.map((c) => c.count));
  return (
    <div className="flex h-56 flex-1 items-end gap-1.5 md:h-72 md:gap-3">
      {cols.map((c) => (
        <div key={c.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
          <span className="font-mono text-xs tabular-nums text-ink/55 md:text-sm">{c.count}</span>
          <div
            className={
              "w-full rounded-t-md transition-[height] duration-700 ease-out " +
              (tone ? tone(c) : highlight?.(c) ? "bg-brand" : "bg-brand/40")
            }
            style={{ height: `${Math.max((c.count / max) * 100, c.count > 0 ? 3 : 0.5)}%` }}
          />
          <span className="font-mono text-xs text-ink/60 md:text-sm">{c.label}</span>
        </div>
      ))}
    </div>
  );
}

function AnswerWall({ question, recent }: { question: Question; recent: RecentResponse[] }) {
  const answers = recent
    .map((r) => ({ id: r.id, text: r.answers?.[question.id] }))
    .filter((a): a is { id: string; text: string } => typeof a.text === "string" && !!a.text.trim())
    .slice(0, 9);
  // Highlight answers that arrived after the wall first rendered.
  const seen = useRef<Set<string> | null>(null);
  const isNew = (id: string) => seen.current != null && !seen.current.has(id);
  useEffect(() => {
    seen.current = new Set(answers.map((a) => a.id));
  });
  if (answers.length === 0) return <EmptyNote />;
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {answers.map((a) => (
        <li
          key={a.id}
          className={
            "rounded-xl border bg-card px-5 py-4 text-lg leading-snug md:text-xl " +
            (isNew(a.id) ? "animate-[live-in_500ms_ease-out] border-brand/40" : "border-hairline")
          }
        >
          “{a.text.length > 220 ? `${a.text.slice(0, 220)}…` : a.text}”
        </li>
      ))}
    </ul>
  );
}

function Big({
  value,
  label,
  align = "left",
}: {
  value: string;
  label: string;
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <p className="font-mono text-6xl font-medium tabular-nums tracking-tight md:text-8xl">
        {value}
      </p>
      <p className="mt-1 font-mono text-xs uppercase tracking-wide text-ink/45 md:text-sm">
        {label}
      </p>
    </div>
  );
}

function EmptyNote() {
  return (
    <p className="mt-6 text-lg text-ink/45">
      Waiting for the first brave soul. Results appear the moment someone answers.
    </p>
  );
}
