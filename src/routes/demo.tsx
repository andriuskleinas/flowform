import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, GitBranch, RotateCcw } from "lucide-react";

import { Logo } from "@/components/logo";

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
              className={`flex w-full items-center gap-3 rounded-md border px-3.5 py-3 text-left text-base transition-colors ${
                isSelected
                  ? "border-brand bg-accent text-ink"
                  : "border-input bg-white text-ink/80 hover:border-ink/35"
              }`}
            >
              <span
                className={`grid size-6 shrink-0 place-items-center rounded-sm border font-mono text-[11px] ${
                  isSelected ? "border-brand bg-brand text-white" : "border-ink/15 text-ink/50"
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

function StepConfirm({
  answered,
  onConfirm,
  hint,
}: {
  answered: boolean;
  onConfirm: () => void;
  hint: string;
}) {
  return (
    <div className="mt-8 flex items-center gap-4">
      <button
        type="button"
        onClick={onConfirm}
        disabled={!answered}
        className="inline-flex h-11 items-center gap-2 rounded-md bg-brand px-6 text-[15px] font-medium text-brand-foreground transition-colors hover:bg-brand/90 disabled:opacity-40"
      >
        OK
      </button>
      <span className="font-mono text-[11px] text-ink/45">{hint}</span>
    </div>
  );
}

function DemoPage() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [idx, setIdx] = useState(0);
  const [name, setName] = useState("");
  const [useCase, setUseCase] = useState<UseCase | null>(null);
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const followUpQ = useCase ? FOLLOW_UPS[useCase] : null;

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
    setIdx(0);
    setPhase("intro");
  }

  // Selecting only records the answer — like the real product, respondents
  // confirm with OK/Enter, so a misclick can be corrected before moving on.
  function pickUseCase(opt: string) {
    if (opt !== useCase) setFollowUp(null);
    setUseCase(opt as UseCase);
  }

  function confirmStep() {
    if (idx === 0 && name.trim()) setIdx(1);
    else if (idx === 1 && useCase) setIdx(2);
    else if (idx === 2 && followUp) setIdx(3);
    else if (idx === 3 && rating !== null) finish();
  }

  const stepAnswered =
    idx === 0
      ? name.trim().length > 0
      : idx === 1
        ? useCase !== null
        : idx === 2
          ? followUp !== null
          : rating !== null;

  function goBack() {
    if (idx > 0) setIdx((i) => i - 1);
  }

  // Keyboard shortcuts: Enter on intro, A–D selects a choice, 1–9/0 selects a
  // rating, Enter confirms the selection and advances.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (phase === "intro" && e.key === "Enter") {
        e.preventDefault();
        start();
        return;
      }
      if (phase !== "run") return;
      if (idx > 0 && e.key === "Enter") {
        e.preventDefault();
        confirmStep();
        return;
      }
      if (idx === 1 || idx === 2) {
        const options = idx === 1 ? USE_CASES : (followUpQ?.options ?? []);
        const i = e.key.length === 1 ? "abcd".indexOf(e.key.toLowerCase()) : -1;
        if (i >= 0 && i < options.length) {
          e.preventDefault();
          if (idx === 1) pickUseCase(options[i]);
          else setFollowUp(options[i]);
        }
      } else if (idx === 3 && /^[0-9]$/.test(e.key)) {
        e.preventDefault();
        setRating(e.key === "0" ? 10 : Number(e.key));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const progress = phase === "intro" ? 0 : phase === "done" ? 100 : (idx / TOTAL_QUESTIONS) * 100;

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      {/* Progress bar */}
      <div className="fixed inset-x-0 top-0 z-50 h-0.5 bg-hairline">
        <div
          className="h-full bg-brand transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-6">
        <Link to="/" aria-label="Back to Flowform home" className="group flex items-center gap-3">
          <ArrowLeft className="size-4 text-ink/50 transition-transform group-hover:-translate-x-0.5" />
          <Logo />
        </Link>
        <div className="flex items-center gap-3">
          {phase === "run" && (
            <span className="font-mono text-xs text-ink/45">
              {idx + 1} / {TOTAL_QUESTIONS}
            </span>
          )}
          <span className="rounded-sm border border-brand/25 bg-accent px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-brand">
            Live demo
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 pb-24">
        {phase === "intro" && (
          <div className="motion-safe:animate-[demo-step-in_0.5s_ease-out_both]">
            <p className="eyebrow">Interactive demo · 4 questions · ~30 seconds</p>
            <h1 className="mt-6 font-display text-6xl leading-[0.98] text-balance md:text-7xl">
              This is a <em className="text-brand">Flowform.</em>
            </h1>
            <p className="mt-6 max-w-md text-lg text-ink/65">
              One question at a time, like a conversation. Four questions, about thirty seconds —
              and one of them adapts to your answers.
            </p>
            <p className="mt-3 text-sm text-ink/45">
              Nothing is stored. It all happens in your browser.
            </p>
            <div className="mt-10 flex items-center gap-4">
              <button
                type="button"
                onClick={start}
                className="inline-flex h-12 items-center gap-2 rounded-md bg-ink px-6 text-[15px] font-medium text-paper transition-colors hover:bg-ink/85"
              >
                Start the demo
                <ArrowRight className="size-4" />
              </button>
              <span className="font-mono text-[11px] text-ink/45">press Enter ↵</span>
            </div>
          </div>
        )}

        {phase === "run" && (
          <div key={idx} className="motion-safe:animate-[demo-step-in_0.4s_ease-out_both]">
            {idx > 0 && (
              <button
                type="button"
                onClick={goBack}
                className="-ml-2 mb-6 inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-sm text-ink/55 transition-colors hover:bg-ink/5 hover:text-ink"
              >
                <ArrowLeft className="size-4" />
                Back
              </button>
            )}

            {idx === 0 && (
              <>
                <h2 className="font-display text-4xl leading-[1.08] text-balance md:text-5xl">
                  First things first — what should we call you?
                </h2>
                <input
                  ref={inputRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      confirmStep();
                    }
                  }}
                  placeholder="Type your name…"
                  maxLength={60}
                  className="mt-8 w-full border-b border-ink/20 bg-transparent pb-3 font-display text-3xl text-ink outline-none transition-colors placeholder:text-ink/25 focus:border-brand"
                />
                <div className="mt-8 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={confirmStep}
                    disabled={!name.trim()}
                    className="inline-flex h-11 items-center gap-2 rounded-md bg-brand px-6 text-[15px] font-medium text-brand-foreground transition-colors hover:bg-brand/90 disabled:opacity-40"
                  >
                    Continue
                    <ArrowRight className="size-4" />
                  </button>
                  <span className="font-mono text-[11px] text-ink/45">press Enter ↵</span>
                </div>
              </>
            )}

            {idx === 1 && (
              <>
                <h2 className="font-display text-4xl leading-[1.08] text-balance md:text-5xl">
                  Nice to meet you{name.trim() ? `, ${name.trim().split(/\s+/)[0]}` : ""}. What
                  would you use Flowform for?
                </h2>
                <ChoiceGrid options={USE_CASES} selected={useCase} onSelect={pickUseCase} />
                <StepConfirm
                  answered={stepAnswered}
                  onConfirm={confirmStep}
                  hint="press A – D, then Enter ↵"
                />
              </>
            )}

            {idx === 2 && followUpQ && (
              <>
                <span className="inline-flex items-center gap-2 rounded-sm border border-dashed border-brand/40 px-2.5 py-1 font-mono text-[11px] text-brand">
                  <GitBranch className="size-3.5" />
                  Logic jump: this question adapted to your answer
                </span>
                <h2 className="mt-5 font-display text-4xl leading-[1.08] text-balance md:text-5xl">
                  {followUpQ.label}
                </h2>
                <ChoiceGrid
                  options={followUpQ.options}
                  selected={followUp}
                  onSelect={setFollowUp}
                />
                <StepConfirm
                  answered={stepAnswered}
                  onConfirm={confirmStep}
                  hint="press A – D, then Enter ↵"
                />
              </>
            )}

            {idx === 3 && (
              <>
                <h2 className="font-display text-4xl leading-[1.08] text-balance md:text-5xl">
                  Last one — how does answering one question at a time feel?
                </h2>
                <div className="mt-8 grid grid-cols-5 gap-2 sm:grid-cols-10">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                    const isSelected = rating === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRating(n)}
                        className={`grid h-12 place-items-center rounded-md border font-mono text-base transition-colors ${
                          isSelected
                            ? "border-brand bg-brand text-white"
                            : "border-input bg-white text-ink/75 hover:border-ink/40"
                        }`}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex justify-between font-mono text-[11px] text-ink/45">
                  <span>Feels like homework</span>
                  <span>Feels like a conversation</span>
                </div>
                <StepConfirm
                  answered={stepAnswered}
                  onConfirm={confirmStep}
                  hint="press 1 – 9 (0 for 10), then Enter ↵"
                />
              </>
            )}
          </div>
        )}

        {phase === "done" && (
          <div className="motion-safe:animate-[demo-step-in_0.5s_ease-out_both]">
            <div>
              <p className="eyebrow flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-brand" /> Demo complete
              </p>
              <h1 className="mt-6 font-display text-5xl leading-[1.02] text-balance md:text-6xl">
                That was a Flowform{name.trim() ? `, ${name.trim().split(/\s+/)[0]}` : ""}.
              </h1>
              <p className="mt-4 max-w-md text-lg text-ink/65">
                {TOTAL_QUESTIONS} answers in {elapsed} second{elapsed === 1 ? "" : "s"}. No wall of
                questions, and one of them adapted to you.
              </p>
            </div>

            <dl className="mt-10 divide-y divide-hairline rounded-lg border border-hairline bg-white px-6 sm:px-7">
              {[
                { q: "Name", a: name.trim() || "—" },
                { q: "Use case", a: useCase ?? "—" },
                { q: followUpQ?.label ?? "Follow-up", a: followUp ?? "—", logic: true },
                { q: "One-at-a-time feel", a: rating ? `${rating} / 10` : "—" },
              ].map(({ q, a, logic }) => (
                <div key={q} className="flex items-baseline justify-between gap-6 py-4">
                  <dt className="flex items-center gap-2 text-sm text-ink/55">
                    {q}
                    {logic && <GitBranch className="size-3.5 text-brand" aria-label="Logic jump" />}
                  </dt>
                  <dd className="text-right text-sm font-medium text-ink">{a}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 font-mono text-[11px] text-ink/45">
              Your answers weren't stored — this demo runs entirely in your browser.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link
                to="/signup"
                className="inline-flex h-12 items-center gap-2 rounded-md bg-ink px-6 text-[15px] font-medium text-paper transition-colors hover:bg-ink/85"
              >
                Build your own, free
                <ArrowRight className="size-4" />
              </Link>
              <button
                type="button"
                onClick={replay}
                className="inline-flex h-12 items-center gap-2 rounded-md px-4 text-[15px] font-medium text-ink/65 transition-colors hover:text-ink"
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
