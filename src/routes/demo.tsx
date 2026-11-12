import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  GitBranch,
  MessagesSquare,
  RotateCcw,
  UserRound,
} from "lucide-react";

import { Logo } from "@/components/logo";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Try Flowform — Live demo" },
      {
        name: "description",
        content:
          "Five questions, one at a time, under a minute. It remembers, adapts and asks why. Nothing is stored.",
      },
      { property: "og:title", content: "Try Flowform — Live demo" },
      {
        property: "og:description",
        content:
          "Five questions, one at a time, under a minute. It remembers, adapts and asks why. Nothing is stored.",
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
    options: ["Email threads", "Spreadsheets", "Another form tool", "We don’t, yet"],
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

const TOTAL_QUESTIONS = 5;

// Follow-ups: in real forms Claude writes one when an answer is short or
// vague. The demo has no server, so it picks a preset the same way.
function isVague(answer: string): boolean {
  const a = answer.trim().toLowerCase();
  return a.split(/\s+/).length < 6 || /^(ok|okay|fine|good|bad|meh|idk|nothing|none|no)\b/.test(a);
}

function presetFollowUp(answer: string): string {
  const a = answer.toLowerCase();
  if (/long|forever|time|slow|minutes?/.test(a))
    return "Roughly how long did it take before you gave up?";
  if (/question|many|endless|repeat|same/.test(a))
    return "How many questions feels like too many to you?";
  if (/phone|mobile|tiny|zoom/.test(a)) return "What went wrong on your phone, exactly?";
  if (/captcha|robot|login|account|sign/.test(a))
    return "What would have made that step feel worth it?";
  return "Could you tell me a bit more about what happened?";
}

// Owner's live-results view on the finish screen: illustrative counts plus
// the visitor's own vote.
const LIVE_BASE: Record<UseCase, number> = {
  "Customer feedback": 41,
  "Research & surveys": 27,
  "Event registrations": 18,
  "Just exploring": 23,
};

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
                  : "border-input bg-card text-ink/80 hover:border-ink/35"
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
  const [annoyance, setAnnoyance] = useState("");
  const [probe, setProbe] = useState<string | null>(null);
  const [probeAnswer, setProbeAnswer] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const annoyRef = useRef<HTMLInputElement>(null);
  const probeRef = useRef<HTMLInputElement>(null);
  const firstName = name.trim().split(/\s+/)[0] ?? "";

  const followUpQ = useCase ? FOLLOW_UPS[useCase] : null;

  useEffect(() => {
    if (phase !== "run") return;
    if (idx === 0) inputRef.current?.focus();
    if (idx === 3) (probe ? probeRef : annoyRef).current?.focus();
  }, [phase, idx, probe]);

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
    setAnnoyance("");
    setProbe(null);
    setProbeAnswer("");
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
    else if (idx === 3 && annoyance.trim()) {
      // A short or vague answer gets one follow-up first; a detailed one doesn't.
      if (!probe && isVague(annoyance)) setProbe(presetFollowUp(annoyance));
      else setIdx(4);
    } else if (idx === 4 && rating !== null) finish();
  }

  const stepAnswered =
    idx === 0
      ? name.trim().length > 0
      : idx === 1
        ? useCase !== null
        : idx === 2
          ? followUp !== null
          : idx === 3
            ? annoyance.trim().length > 0
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
      // Text inputs handle their own Enter.
      if (e.target instanceof HTMLInputElement) return;
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
      } else if (idx === 4 && /^[0-9]$/.test(e.key)) {
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
            <span className="inline-flex items-center gap-2 rounded-full bg-sky-tint px-3 py-1 text-sm font-medium text-sky">
              Interactive demo · 5 questions · under a minute
            </span>
            <h1 className="mt-6 font-display text-5xl leading-[1.02] text-balance md:text-6xl">
              This is a <em className="text-brand">Flowform.</em>
            </h1>
            <p className="mt-6 max-w-md text-lg text-ink/65">
              Five questions, one at a time. Watch it remember your name, adapt to your answers and
              ask why when you’re brief. Shorter than most meetings about surveys.
            </p>
            <p className="mt-3 text-sm text-ink/45">
              Nothing is stored. It all runs in your browser.
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
                className="-ml-2 mb-6 flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-sm text-ink/55 transition-colors hover:bg-ink/5 hover:text-ink"
              >
                <ArrowLeft className="size-4" />
                Back
              </button>
            )}

            {idx === 0 && (
              <>
                <h2 className="font-display text-3xl leading-[1.08] text-balance md:text-4xl">
                  First things first. What should we call you?
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
                  className="mt-8 w-full border-b border-ink/20 bg-transparent pb-3 font-display text-2xl text-ink outline-none transition-colors placeholder:text-ink/25 focus:border-brand"
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
                {firstName && (
                  <FeatureTag icon={UserRound}>
                    Answer recall: your name, from question 1
                  </FeatureTag>
                )}
                <h2 className="mt-5 font-display text-3xl leading-[1.08] text-balance md:text-4xl">
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
                <FeatureTag icon={GitBranch}>
                  Logic jump: this question adapted to your answer
                </FeatureTag>
                <h2 className="mt-5 font-display text-3xl leading-[1.08] text-balance md:text-4xl">
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
                <h2 className="font-display text-3xl leading-[1.08] text-balance md:text-4xl">
                  What’s the most annoying thing a form has ever done to you?
                </h2>
                <input
                  ref={annoyRef}
                  value={annoyance}
                  onChange={(e) => setAnnoyance(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      confirmStep();
                    }
                  }}
                  readOnly={!!probe}
                  placeholder="Type your answer…"
                  maxLength={200}
                  className="mt-8 w-full border-b border-ink/20 bg-transparent pb-3 font-display text-2xl text-ink outline-none transition-colors placeholder:text-ink/25 focus:border-brand read-only:text-ink/60"
                />
                {probe ? (
                  <div className="mt-8 rounded-lg border border-brand/25 bg-accent/60 p-5 motion-safe:animate-[demo-step-in_0.4s_ease-out_both]">
                    <FeatureTag icon={MessagesSquare}>
                      Follow-up: asked because your answer was short
                    </FeatureTag>
                    <p className="mt-3 text-lg font-medium text-ink">{probe}</p>
                    <input
                      ref={probeRef}
                      value={probeAnswer}
                      onChange={(e) => setProbeAnswer(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          confirmStep();
                        }
                      }}
                      placeholder="Optional. Add a little more…"
                      maxLength={200}
                      className="mt-3 w-full border-b border-ink/20 bg-transparent pb-2 text-lg text-ink outline-none transition-colors placeholder:text-ink/30 focus:border-brand"
                    />
                    <p className="mt-3 text-xs text-ink/50">
                      In your forms, Claude writes this on the spot. The demo has no server, so it
                      uses a preset.
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-ink/45">Tip: be brief and see what happens.</p>
                )}
                <StepConfirm answered={stepAnswered} onConfirm={confirmStep} hint="press Enter ↵" />
              </>
            )}

            {idx === 4 && (
              <>
                <h2 className="font-display text-3xl leading-[1.08] text-balance md:text-4xl">
                  Last one. How does one question at a time feel?
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
                            : "border-input bg-card text-ink/75 hover:border-ink/40"
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
              <p className="inline-flex items-center gap-1.5 rounded-full bg-mint-tint px-3 py-1 text-sm font-medium text-mint">
                <CheckCircle2 className="size-3.5" /> Demo complete
              </p>
              <h1 className="mt-6 font-display text-4xl leading-[1.02] text-balance md:text-5xl">
                That was a Flowform{name.trim() ? `, ${name.trim().split(/\s+/)[0]}` : ""}.
              </h1>
              <p className="mt-4 max-w-md text-lg text-ink/65">
                {TOTAL_QUESTIONS} answers in {elapsed} second{elapsed === 1 ? "" : "s"}. It
                remembered your name, adapted to your answers and asked why when you were brief.
              </p>
            </div>

            <dl className="mt-10 divide-y divide-hairline rounded-lg border border-hairline bg-card px-6 sm:px-7">
              {[
                { q: "Name", a: name.trim() || "—" },
                { q: "Use case", a: useCase ?? "—" },
                { q: followUpQ?.label ?? "Follow-up", a: followUp ?? "—", logic: true },
                { q: "Most annoying form moment", a: annoyance.trim() || "—" },
                ...(probe ? [{ q: probe, a: probeAnswer.trim() || "(skipped)" }] : []),
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
              Nothing was stored. The demo runs entirely in your browser.
            </p>

            {useCase && <OwnerView choice={useCase} />}

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link
                to="/signup"
                className="inline-flex h-12 items-center gap-2 rounded-md bg-ink px-6 text-[15px] font-medium text-paper transition-colors hover:bg-ink/85"
              >
                Build your own
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

/** Small label calling out which Flowform feature the visitor just saw. */
function FeatureTag({
  icon: Icon,
  children,
}: {
  icon: typeof GitBranch;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-sm border border-dashed border-brand/40 px-2.5 py-1 font-mono text-[11px] text-brand">
      <Icon className="size-3.5 shrink-0" />
      {children}
    </span>
  );
}

/**
 * The other side of the form: the owner's live results for the use-case
 * question, with the visitor's vote added in and highlighted.
 */
function OwnerView({ choice }: { choice: UseCase }) {
  const [counted, setCounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setCounted(true), 700);
    return () => clearTimeout(t);
  }, []);
  const counts = USE_CASES.map((u) => LIVE_BASE[u] + (counted && u === choice ? 1 : 0));
  const total = counts.reduce((a, b) => a + b, 0);
  const max = Math.max(...counts);
  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl leading-tight text-ink">What the form’s owner sees</h2>
      <p className="mt-2 max-w-md text-[15px] text-ink/60">
        Answers arrive the moment they’re sent. Put them on a big screen and it’s a live poll.
      </p>
      <div className="mt-6 overflow-hidden rounded-lg border border-hairline bg-card">
        <div className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-2.5 font-mono text-[11px] text-ink/45">
          <span className="truncate">Live results · Example data plus your answer</span>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-coral">
            <span className="size-1.5 rounded-full bg-coral motion-safe:animate-pulse" />
            LIVE
          </span>
        </div>
        <div className="px-5 py-5">
          <p className="text-sm font-medium text-ink">What would you use Flowform for?</p>
          <ul className="mt-4 space-y-3">
            {USE_CASES.map((u, i) => {
              const mine = u === choice;
              return (
                <li key={u}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className={mine ? "font-medium text-ink" : "text-ink/70"}>
                      {u}
                      {mine && (
                        <span className="ml-2 rounded-sm bg-brand px-1.5 py-px font-mono text-[10px] text-white">
                          YOU
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-ink/55">{counts[i]}</span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-sm bg-surface">
                    <div
                      className={`h-2 rounded-sm transition-[width] duration-700 ease-out ${
                        mine ? "bg-brand" : counts[i] === max ? "bg-ink/45" : "bg-ink/20"
                      }`}
                      style={{ width: `${(counts[i] / total) * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <p className="border-t border-hairline bg-paper px-5 py-3 text-[13px] text-ink/60">
          Also on the owner’s side: a Claude summary of answers like yours, the question where
          people quit, “Ask your results” and CSV or PDF export.
        </p>
      </div>
    </section>
  );
}
