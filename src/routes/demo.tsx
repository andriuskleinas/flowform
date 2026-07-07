import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUp, CheckCircle2, RotateCcw, Zap } from "lucide-react";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Experience Flowform — Live demo" },
      {
        name: "description",
        content:
          "Try a real Flowform: four questions, one at a time, in about thirty seconds. Nothing is stored.",
      },
      { property: "og:title", content: "Experience Flowform — Live demo" },
      {
        property: "og:description",
        content:
          "Try a real Flowform: four questions, one at a time, in about thirty seconds. Nothing is stored.",
      },
    ],
  }),
  component: DemoPage,
});

const USE_CASES = [
  "Customer feedback",
  "Research & surveys",
  "Event registrations",
  "Just exploring",
] as const;

type UseCase = (typeof USE_CASES)[number];

// The follow-up question branches on the previous answer — this is the
// "logic that adapts" feature demonstrated live.
const FOLLOW_UPS: Record<UseCase, { label: string; options: string[] }> = {
  "Customer feedback": {
    label: "How do you collect feedback today?",
    options: ["Email threads", "Spreadsheets", "Another form tool", "We don't — yet"],
  },
  "Research & surveys": {
    label: "How many responses does a typical study need?",
    options: ["Under 50", "50 – 500", "500 – 5,000", "As many as possible"],
  },
  "Event registrations": {
    label: "What kind of events do you run?",
    options: ["Conferences", "Workshops", "Meetups", "Private dinners"],
  },
  "Just exploring": {
    label: "What made you curious?",
    options: ["The design", "The AI features", "A friend sent me", "Just clicking around"],
  },
};

const TOTAL_QUESTIONS = 4;

type Phase = "intro" | "run" | "done";

function ChoiceGrid({
  options,
  selected,
  onSelect,
}: {
  options: readonly string[];
  selected: string | null;
  onSelect: (opt: string) => void;
}) {
  return (
    <ul className="mt-8 grid gap-3 sm:grid-cols-2">
      {options.map((opt, i) => {
        const isSelected = selected === opt;
        return (
          <li key={opt}>
            <button
              type="button"
              onClick={() => onSelect(opt)}
              className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-base font-medium transition-all ${
                isSelected
                  ? "border-brand bg-brand/10 text-brand shadow-md shadow-brand/10"
                  : "border-ink/10 bg-white text-ink/80 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
              }`}
            >
              <span
                className={`grid size-6 shrink-0 place-items-center rounded border text-[11px] font-bold ${
                  isSelected ? "border-brand bg-brand text-white" : "border-ink/15 text-ink/40"
                }`}
              >
                {String.fromCharCode(65 + i)}
              </span>
              {opt}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function DemoPage() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [idx, setIdx] = useState(0);
  const [name, setName] = useState("");
  const [useCase, setUseCase] = useState<UseCase | null>(null);
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const followUpQ = useCase ? FOLLOW_UPS[useCase] : null;

  useEffect(() => () => clearTimeout(timerRef.current ?? undefined), []);

  useEffect(() => {
    if (phase === "run" && idx === 0) inputRef.current?.focus();
  }, [phase, idx]);

  function start() {
    startRef.current = Date.now();
    setPhase("run");
  }

  function finish() {
    setElapsed(Math.max(1, Math.round((Date.now() - startRef.current) / 1000)));
    setPhase("done");
  }

  function replay() {
    setName("");
    setUseCase(null);
    setFollowUp(null);
    setRating(null);
    setFlash(null);
    setIdx(0);
    setPhase("intro");
  }

  // Briefly show the selection, then advance — feels like the real product.
  function selectAndAdvance(commit: () => void, isLast = false) {
    if (flash !== null) return;
    commit();
    timerRef.current = setTimeout(() => {
      setFlash(null);
      if (isLast) finish();
      else setIdx((i) => i + 1);
    }, 400);
  }

  function pickUseCase(opt: string) {
    setFlash(opt);
    selectAndAdvance(() => setUseCase(opt as UseCase));
  }

  function pickFollowUp(opt: string) {
    setFlash(opt);
    selectAndAdvance(() => setFollowUp(opt));
  }

  function pickRating(n: number) {
    setFlash(String(n));
    selectAndAdvance(() => setRating(n), true);
  }

  function submitName() {
    if (name.trim()) setIdx(1);
  }

  function goBack() {
    if (idx > 0) setIdx((i) => i - 1);
  }

  // Keyboard shortcuts: Enter on intro, A–D on choices, 1–9/0 on the rating.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (phase === "intro" && e.key === "Enter") {
        e.preventDefault();
        start();
        return;
      }
      if (phase !== "run" || flash !== null) return;
      if (idx === 1 || idx === 2) {
        const options = idx === 1 ? USE_CASES : (followUpQ?.options ?? []);
        const i = e.key.length === 1 ? "abcd".indexOf(e.key.toLowerCase()) : -1;
        if (i >= 0 && i < options.length) {
          e.preventDefault();
          (idx === 1 ? pickUseCase : pickFollowUp)(options[i]);
        }
      } else if (idx === 3 && /^[0-9]$/.test(e.key)) {
        e.preventDefault();
        pickRating(e.key === "0" ? 10 : Number(e.key));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const progress = phase === "intro" ? 0 : phase === "done" ? 100 : (idx / TOTAL_QUESTIONS) * 100;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-surface via-white to-surface text-ink">
      {/* Progress bar */}
      <div className="fixed inset-x-0 top-0 z-50 h-1 bg-ink/5">
        <div
          className="h-full bg-brand transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2 text-sm text-ink/70 hover:text-ink">
          <ArrowLeft className="size-4" />
          Back to home
        </Link>
        <div className="flex items-center gap-3">
          {phase === "run" && (
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/40">
              {idx + 1} / {TOTAL_QUESTIONS}
            </span>
          )}
          <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand">
            Live demo
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 pb-24">
        {phase === "intro" && (
          <div className="text-center motion-safe:animate-[demo-step-in_0.5s_ease-out_both]">
            <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-brand">
              <span className="size-4 rounded-sm bg-white" />
            </span>
            <h1 className="mt-8 text-4xl font-extrabold tracking-tight text-balance md:text-5xl">
              This is a <span className="text-brand">Flowform.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-md text-lg text-ink/60">
              One question at a time, like a conversation. Four questions, about thirty seconds —
              and one of them adapts to your answers.
            </p>
            <p className="mt-3 text-sm text-ink/40">
              Nothing is stored. It all happens in your browser.
            </p>
            <div className="mt-10 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={start}
                className="inline-flex items-center gap-2 rounded-full bg-brand px-8 py-4 text-base font-semibold text-brand-foreground shadow-lg shadow-brand/25 transition-all hover:scale-[1.02]"
              >
                Start the demo
                <ArrowRight className="size-4" />
              </button>
              <span className="text-xs text-ink/40">press Enter ↵</span>
            </div>
          </div>
        )}

        {phase === "run" && (
          <div key={idx} className="motion-safe:animate-[demo-step-in_0.4s_ease-out_both]">
            {idx > 0 && (
              <button
                type="button"
                onClick={goBack}
                className="mb-6 flex w-fit items-center gap-1.5 text-xs font-medium text-ink/40 transition-colors hover:text-ink"
              >
                <ArrowUp className="size-3.5" />
                Previous question
              </button>
            )}

            {idx === 0 && (
              <>
                <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                  First things first — what should we call you?
                </h2>
                <input
                  ref={inputRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitName();
                    }
                  }}
                  placeholder="Type your name…"
                  maxLength={60}
                  className="mt-8 w-full border-b-2 border-ink/15 bg-transparent pb-3 text-2xl font-medium text-ink outline-none transition-colors placeholder:text-ink/25 focus:border-brand"
                />
                <div className="mt-8 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={submitName}
                    disabled={!name.trim()}
                    className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground shadow-md shadow-brand/20 transition-all enabled:hover:scale-[1.02] disabled:opacity-40"
                  >
                    Continue
                    <ArrowRight className="size-4" />
                  </button>
                  <span className="text-xs text-ink/40">press Enter ↵</span>
                </div>
              </>
            )}

            {idx === 1 && (
              <>
                <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                  Nice to meet you{name.trim() ? `, ${name.trim().split(/\s+/)[0]}` : ""}. What
                  would you use Flowform for?
                </h2>
                <ChoiceGrid options={USE_CASES} selected={flash} onSelect={pickUseCase} />
                <p className="mt-6 text-xs text-ink/40">press A – D</p>
              </>
            )}

            {idx === 2 && followUpQ && (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-gold-foreground/80">
                  <Zap className="size-3 text-gold" />
                  Logic jump — this question adapted to your answer
                </span>
                <h2 className="mt-5 text-3xl font-bold tracking-tight md:text-4xl">
                  {followUpQ.label}
                </h2>
                <ChoiceGrid options={followUpQ.options} selected={flash} onSelect={pickFollowUp} />
                <p className="mt-6 text-xs text-ink/40">press A – D</p>
              </>
            )}

            {idx === 3 && (
              <>
                <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                  Last one — how does answering one question at a time feel?
                </h2>
                <div className="mt-8 grid grid-cols-5 gap-2 sm:grid-cols-10">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                    const isSelected = flash === String(n);
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => pickRating(n)}
                        className={`grid h-12 place-items-center rounded-lg border text-sm font-semibold transition-all ${
                          isSelected
                            ? "border-brand bg-brand text-white shadow-md shadow-brand/25"
                            : "border-ink/10 bg-white text-ink/70 hover:-translate-y-0.5 hover:border-brand/40 hover:text-brand"
                        }`}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex justify-between text-xs text-ink/40">
                  <span>Feels like homework</span>
                  <span>Feels like a conversation</span>
                </div>
                <p className="mt-6 text-xs text-ink/40">press 1 – 9, or 0 for 10</p>
              </>
            )}
          </div>
        )}

        {phase === "done" && (
          <div className="motion-safe:animate-[demo-step-in_0.5s_ease-out_both]">
            <div className="text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand/10">
                <CheckCircle2 className="size-7 text-brand" strokeWidth={2} />
              </div>
              <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-balance md:text-5xl">
                That was a Flowform{name.trim() ? `, ${name.trim().split(/\s+/)[0]}` : ""}.
              </h1>
              <p className="mx-auto mt-3 max-w-md text-lg text-ink/60">
                {TOTAL_QUESTIONS} answers in {elapsed} second{elapsed === 1 ? "" : "s"} — no wall of
                questions, no drop-off.
              </p>
            </div>

            <dl className="mt-10 space-y-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm sm:p-8">
              {[
                { q: "Name", a: name.trim() || "—" },
                { q: "Use case", a: useCase ?? "—" },
                { q: followUpQ?.label ?? "Follow-up", a: followUp ?? "—", logic: true },
                { q: "One-at-a-time feel", a: rating ? `${rating} / 10` : "—" },
              ].map(({ q, a, logic }) => (
                <div
                  key={q}
                  className="flex items-baseline justify-between gap-6 border-b border-ink/5 pb-4 last:border-0 last:pb-0"
                >
                  <dt className="flex items-center gap-2 text-sm text-ink/50">
                    {q}
                    {logic && <Zap className="size-3 text-gold" />}
                  </dt>
                  <dd className="text-right text-sm font-semibold text-ink">{a}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-center text-xs text-ink/40">
              Your answers weren't stored — this demo runs entirely in your browser.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 rounded-full bg-brand px-8 py-4 text-base font-semibold text-brand-foreground shadow-lg shadow-brand/25 transition-all hover:scale-[1.02]"
              >
                Build your own — free
                <ArrowRight className="size-4" />
              </Link>
              <button
                type="button"
                onClick={replay}
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-ink/70 transition-colors hover:text-ink"
              >
                <RotateCcw className="size-4" />
                Replay demo
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
