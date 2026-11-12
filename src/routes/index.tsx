import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Code2,
  CornerDownLeft,
  Download,
  Gift,
  Layers,
  Lightbulb,
  MessagesSquare,
  Palette,
  QrCode,
  Quote,
  RotateCcw,
  Search,
  Signpost,
  TrendingDown,
  Trophy,
  UserRoundX,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";

import { useAuth } from "@/hooks/use-auth";
import { UserMenu } from "@/components/user-menu";
import { Logo } from "@/components/logo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BuiltBy } from "@/components/built-by";

export const Route = createFileRoute("/")({
  component: Index,
});

const REPO_URL = "https://github.com/andriuskleinas/flowform";

/* ------------------------------------------------------------------------ */
/* Shared bits                                                              */
/* ------------------------------------------------------------------------ */

function PrimaryCTA({
  children,
  size = "md",
  tone = "ink",
}: {
  children: React.ReactNode;
  size?: "sm" | "md";
  tone?: "ink" | "paper";
}) {
  const { session } = useAuth();
  const to = session ? "/dashboard" : "/signup";
  const sizing = size === "sm" ? "h-9 px-3.5 text-sm" : "h-12 px-6 text-[15px]";
  const toneClass =
    tone === "ink" ? "bg-ink text-paper hover:bg-ink/85" : "bg-paper text-ink hover:bg-card";
  return (
    <Link
      to={to}
      data-cta="get-started"
      className={`group inline-flex items-center gap-2 rounded-md font-medium whitespace-nowrap transition-colors ${sizing} ${toneClass}`}
    >
      {children}
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

type Hue = "sky" | "coral" | "mint" | "sun";

const HUE: Record<Hue, { tag: string; stage: string; dot: string }> = {
  sky: { tag: "bg-sky-tint text-sky", stage: "bg-sky-tint", dot: "bg-sky" },
  coral: { tag: "bg-coral-tint text-coral", stage: "bg-coral-tint", dot: "bg-coral" },
  mint: { tag: "bg-mint-tint text-mint", stage: "bg-mint-tint", dot: "bg-mint" },
  sun: { tag: "bg-sun-tint text-sun", stage: "bg-sun-tint", dot: "bg-sun" },
};

type Glyph = "build" | "branch" | "learn" | "present";

/** Accent bar colour per hue, bright enough to read on the ink tile. */
const GLYPH_ACCENT: Record<Hue, string> = {
  sky: "oklch(0.72 0.15 258)",
  coral: "oklch(0.74 0.15 38)",
  mint: "oklch(0.78 0.12 165)",
  sun: "oklch(0.84 0.14 82)",
};

/**
 * Section icons drawn from the Flowform mark: the same ink tile and "answer
 * bars", rearranged per step. One bar takes the section's colour.
 */
function SectionGlyph({ kind, hue }: { kind: Glyph; hue: Hue }) {
  const paper = "var(--paper)";
  const accent = GLYPH_ACCENT[hue];
  return (
    <svg viewBox="0 0 32 32" aria-hidden className="size-8 shrink-0">
      <rect width="32" height="32" rx="7" fill="var(--ink)" />
      {kind === "build" && (
        <>
          <rect x="7" y="9" width="18" height="4" rx="1.5" fill={paper} />
          <rect x="7" y="17" width="10" height="4" rx="1.5" fill={accent} />
          <rect x="19.5" y="18.25" width="5.5" height="1.5" rx="0.75" fill={paper} />
          <rect x="21.5" y="16.25" width="1.5" height="5.5" rx="0.75" fill={paper} />
        </>
      )}
      {kind === "branch" && (
        <>
          <rect x="7" y="8" width="18" height="4" rx="1.5" fill={paper} />
          <rect x="7" y="16" width="1.5" height="4" rx="0.75" fill={paper} opacity="0.35" />
          <rect x="23.5" y="16" width="1.5" height="4" rx="0.75" fill={accent} />
          <rect x="7" y="20" width="7.5" height="4" rx="1.5" fill={paper} opacity="0.35" />
          <rect x="17.5" y="20" width="7.5" height="4" rx="1.5" fill={accent} />
        </>
      )}
      {kind === "present" && (
        <>
          <rect x="7" y="8" width="18" height="11" rx="1.5" fill={paper} opacity="0.35" />
          <rect x="9.5" y="14" width="3" height="3" rx="0.75" fill={paper} />
          <rect x="14.5" y="11" width="3" height="6" rx="0.75" fill={accent} />
          <rect x="19.5" y="12.5" width="3" height="4.5" rx="0.75" fill={paper} />
          <rect x="15" y="19" width="2" height="4" rx="0.75" fill={paper} opacity="0.35" />
          <rect x="11" y="23" width="10" height="1.5" rx="0.75" fill={paper} opacity="0.35" />
        </>
      )}
      {kind === "learn" && (
        <>
          <rect x="7" y="17" width="4.5" height="7" rx="1.5" fill={paper} />
          <rect x="13.75" y="13" width="4.5" height="11" rx="1.5" fill={paper} />
          <rect x="20.5" y="8" width="4.5" height="16" rx="1.5" fill={accent} />
        </>
      )}
    </svg>
  );
}

/** Section marker: glyph tile, plain label, optional note (e.g. the AI part). */
function SectionMark({
  kind,
  hue,
  label,
  note,
}: {
  kind: Glyph;
  hue: Hue;
  label: string;
  note?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <SectionGlyph kind={kind} hue={hue} />
      <span className="text-[15px] font-medium text-ink">{label}</span>
      {note && (
        <>
          <span className="h-4 w-px bg-ink/15" aria-hidden />
          <span className="text-sm text-ink/55">{note}</span>
        </>
      )}
    </div>
  );
}

/** Soft coloured backdrop a product mock-up floats on. */
function Stage({
  hue,
  children,
  className = "",
}: {
  hue: Hue;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl p-4 sm:p-8 lg:p-10 ${HUE[hue].stage} ${className}`}>
      {children}
    </div>
  );
}

/** A product "window": white sheet, hairline border, one soft ambient shadow. */
function Sheet({
  children,
  className = "",
  bar,
}: {
  children: React.ReactNode;
  className?: string;
  bar?: React.ReactNode;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-hairline bg-card shadow-[0_1px_0_rgb(0_0_0/0.03),0_30px_60px_-30px_rgb(20_22_30/0.22)] ${className}`}
    >
      {bar && (
        <div className="flex items-center justify-between gap-4 border-b border-hairline px-4 py-2.5 font-mono text-[11px] text-ink/45">
          {bar}
        </div>
      )}
      {children}
    </div>
  );
}

function Tag({ children, tone = "ink" }: { children: React.ReactNode; tone?: "ink" | "brand" }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-1.5 py-px font-mono text-[10px] font-medium uppercase tracking-wide ${
        tone === "brand"
          ? "border-brand/25 bg-accent text-brand"
          : "border-hairline bg-surface text-ink/55"
      }`}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------------ */
/* Hero demo — answer the form on one side, watch the results on the other   */
/* ------------------------------------------------------------------------ */

type HeroStepId = "quit" | "count" | "ask";

const HERO_ORDER: HeroStepId[] = ["quit", "count", "ask"];

/** `base` is example data: how earlier "visitors" answered each question. */
const HERO_STEPS: Record<
  HeroStepId,
  { n: number; title: string; short: string; options: string[]; base: number[] }
> = {
  quit: {
    n: 1,
    title: "What makes you give up on a survey?",
    short: "Why people give up",
    options: [
      "Too many questions",
      "Questions that don’t apply to me",
      "No idea who reads the answers",
      "I always finish",
    ],
    base: [58, 37, 22, 9],
  },
  count: {
    n: 2,
    title: "How many questions is too many?",
    short: "How many is too many",
    options: ["More than 5", "More than 10", "More than 20", "More than 40"],
    base: [14, 27, 12, 5],
  },
  ask: {
    n: 3,
    title: "What would you ask your own audience?",
    short: "What they’d ask",
    options: ["How we did", "What to build next", "How the team is doing", "Who wins the quiz"],
    base: [41, 36, 30, 19],
  },
};
const HERO_TOTAL = HERO_ORDER.length;
const HERO_BASE_RESPONSES = 126;

type HeroCounts = Record<HeroStepId, number[]>;
const heroBaseCounts = (): HeroCounts => ({
  quit: [...HERO_STEPS.quit.base],
  count: [...HERO_STEPS.count.base],
  ask: [...HERO_STEPS.ask.base],
});

/** The one jump rule in the example form: only "Too many questions" asks Q2. */
function heroNext(step: HeroStepId, answer: string | undefined): HeroStepId | "done" {
  if (step === "quit") return answer === HERO_STEPS.quit.options[0] ? "count" : "ask";
  if (step === "count") return "ask";
  return "done";
}

/**
 * The product loop in one view. Left: a working three-question Flowform
 * (click, or A–D and Enter; one answer skips a question). Right: what the
 * form's owner sees. Example answers trickle in, and when the visitor
 * finishes, their own response lands in the results. Nothing is stored.
 */
function HeroDemo() {
  const [step, setStep] = useState<HeroStepId | "done">("quit");
  const [answers, setAnswers] = useState<Partial<Record<HeroStepId, string>>>({});
  const [history, setHistory] = useState<HeroStepId[]>([]);
  const [counts, setCounts] = useState<HeroCounts>(heroBaseCounts);
  const [others, setOthers] = useState(0);
  /** A results question the visitor opened by hand; follows the form otherwise. */
  const [peek, setPeek] = useState<HeroStepId | null>(null);

  // Moving between steps unmounts the focused OK button, which would drop focus
  // to <body> and kill the keyboard shortcuts. Once the visitor has used the
  // form, keep focus on it (never on first load, so the page isn't hijacked).
  const formRef = useRef<HTMLDivElement>(null);
  const engaged = useRef(false);
  useEffect(() => {
    if (engaged.current) formRef.current?.focus({ preventScroll: true });
    setPeek(null);
  }, [step]);

  // Other people's answers keep arriving, so the results feel like the real
  // live view. Capped, and still for anyone who prefers reduced motion.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      setOthers((n) => {
        if (n >= 40) return n;
        const pickFrom = (weights: number[]) => {
          let r = Math.random() * weights.reduce((x, y) => x + y, 0);
          return weights.findIndex((w) => (r -= w) < 0);
        };
        const q1 = pickFrom(HERO_STEPS.quit.base);
        const q2 = q1 === 0 ? pickFrom(HERO_STEPS.count.base) : -1;
        const q3 = pickFrom(HERO_STEPS.ask.base);
        setCounts((c) => ({
          quit: c.quit.map((v, i) => (i === q1 ? v + 1 : v)),
          count: c.count.map((v, i) => (i === q2 ? v + 1 : v)),
          ask: c.ask.map((v, i) => (i === q3 ? v + 1 : v)),
        }));
        return n + 1;
      });
    }, 2600);
    return () => clearInterval(t);
  }, []);

  const done = step === "done";
  const current = done ? null : HERO_STEPS[step];
  const picked = done ? undefined : answers[step];
  const progress = done ? 1 : (current!.n - 1) / HERO_TOTAL;

  const pick = (opt: string) => {
    if (done) return;
    setAnswers((a) => ({ ...a, [step]: opt }));
  };
  const advance = () => {
    if (done || !picked) return;
    setHistory((h) => [...h, step]);
    setStep(heroNext(step, picked));
  };
  const back = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setStep(prev);
  };
  const restart = () => {
    setAnswers({});
    setHistory([]);
    setStep("quit");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Enter") {
      e.preventDefault();
      if (done) restart();
      else advance();
      return;
    }
    if (!current) return;
    const i = "abcd".indexOf(e.key.toLowerCase());
    if (i >= 0 && i < current.options.length) {
      e.preventDefault();
      pick(current.options[i]);
    }
  };

  // The visitor's response counts once they finish, like a real submission.
  const mine = (id: HeroStepId) => (done && history.includes(id) ? answers[id] : undefined);
  const shown: HeroCounts = {
    quit: counts.quit.map((v, i) => v + (mine("quit") === HERO_STEPS.quit.options[i] ? 1 : 0)),
    count: counts.count.map((v, i) => v + (mine("count") === HERO_STEPS.count.options[i] ? 1 : 0)),
    ask: counts.ask.map((v, i) => v + (mine("ask") === HERO_STEPS.ask.options[i] ? 1 : 0)),
  };
  const focus: HeroStepId = peek ?? (done ? "quit" : step);

  return (
    <div className="grid gap-x-6 gap-y-10 lg:grid-cols-2">
      {/* ------------------------------ The form ------------------------------ */}
      <figure className="min-w-0">
        <figcaption className="mb-3 flex items-baseline gap-2 text-sm">
          <span className="font-medium text-ink">The form</span>
          <span className="text-ink/50">Go on, answer it.</span>
        </figcaption>
        <div
          ref={formRef}
          tabIndex={-1}
          className="outline-none"
          onKeyDown={onKeyDown}
          onPointerDown={() => (engaged.current = true)}
          onFocus={() => (engaged.current = true)}
        >
          <Sheet
            bar={
              <>
                <span className="truncate">flowformapp.vercel.app/f/why-surveys-fail</span>
                <span className="shrink-0">{done ? "Done" : `${current!.n} / ${HERO_TOTAL}`}</span>
              </>
            }
          >
            <div className="h-px bg-hairline">
              <div
                className="h-px bg-brand transition-[width] duration-500 ease-out"
                style={{ width: `${Math.max(progress, 0.04) * 100}%` }}
              />
            </div>

            {current ? (
              <div
                key={step}
                className="min-h-[26.5rem] px-6 pt-6 pb-6 motion-safe:animate-[demo-step-in_0.35s_ease-out_both] sm:px-8 sm:pt-7"
              >
                <div className="flex h-7 items-center justify-between">
                  <p className="font-mono text-xs text-ink/50">
                    <span className="text-brand">{String(current.n).padStart(2, "0")}</span>
                    <span className="mx-1.5 text-ink/25">/</span>
                    {String(HERO_TOTAL).padStart(2, "0")}
                  </p>
                  {history.length > 0 && (
                    <button
                      type="button"
                      onClick={back}
                      className="-mr-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-ink/55 transition-colors hover:bg-ink/5 hover:text-ink"
                    >
                      <ArrowLeft className="size-3.5" /> Back
                    </button>
                  )}
                </div>
                <h3 className="mt-2 font-display text-[1.5rem] leading-[1.1] text-balance text-ink sm:text-[1.75rem]">
                  {current.title}
                </h3>
                <ul className="mt-5 grid gap-2" role="radiogroup" aria-label={current.title}>
                  {current.options.map((opt, i) => {
                    const active = opt === picked;
                    return (
                      <li key={opt}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => pick(opt)}
                          className={`flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left text-[15px] transition-colors ${
                            active
                              ? "border-brand bg-accent text-ink"
                              : "border-hairline bg-card text-ink/75 hover:border-ink/25"
                          }`}
                        >
                          <span
                            className={`grid size-6 shrink-0 place-items-center rounded-sm border font-mono text-[11px] ${
                              active
                                ? "border-brand bg-brand text-white"
                                : "border-ink/15 text-ink/50"
                            }`}
                          >
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span className="flex-1">{opt}</span>
                          {active && <Check className="size-4 text-brand" strokeWidth={2.5} />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-5 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={advance}
                    disabled={!picked}
                    className="inline-flex h-10 items-center rounded-md bg-brand px-5 text-sm font-medium text-white transition-colors hover:bg-brand/90 disabled:opacity-40"
                  >
                    OK
                  </button>
                  <span className="hidden items-center gap-1.5 font-mono text-[11px] text-ink/45 sm:inline-flex">
                    press A–D, then Enter <CornerDownLeft className="size-3" />
                  </span>
                </div>
              </div>
            ) : (
              <div className="min-h-[26.5rem] px-6 pt-7 pb-6 motion-safe:animate-[demo-step-in_0.35s_ease-out_both] sm:px-8">
                <p className="inline-flex items-center gap-1.5 text-sm font-medium text-mint">
                  <Check className="size-4" strokeWidth={2.5} /> Response recorded (not really)
                </p>
                <h3 className="mt-3 font-display text-[1.75rem] leading-[1.08] text-ink">
                  That was a Flowform.
                </h3>
                <p className="mt-2 text-[15px] text-ink/60">
                  Your answers just landed in the results.
                </p>
                <ol className="mt-5 divide-y divide-hairline border-y border-hairline text-[15px]">
                  {HERO_ORDER.map((id) => {
                    const skipped = !history.includes(id);
                    return (
                      <li key={id} className="flex items-baseline justify-between gap-4 py-2.5">
                        <span className={skipped ? "text-ink/40" : "text-ink/60"}>
                          {HERO_STEPS[id].short}
                        </span>
                        <span
                          className={`text-right ${skipped ? "text-ink/40 italic" : "text-ink"}`}
                        >
                          {skipped ? "Skipped, didn’t apply" : answers[id]}
                        </span>
                      </li>
                    );
                  })}
                </ol>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={restart}
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-input bg-card px-4 text-sm font-medium text-ink transition-colors hover:border-ink/35"
                  >
                    <RotateCcw className="size-3.5" /> Try another path
                  </button>
                  <Link
                    to="/demo"
                    className="inline-flex h-10 items-center gap-1.5 px-2 text-sm font-medium text-ink/65 transition-colors hover:text-ink"
                  >
                    Full demo <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </Sheet>
        </div>
      </figure>

      {/* ----------------------------- The results ---------------------------- */}
      <figure className="min-w-0">
        <figcaption className="mb-3 flex items-baseline gap-2 text-sm">
          <span className="font-medium text-ink">Your results</span>
          <span className="text-ink/50">They update as people finish.</span>
        </figcaption>
        <Sheet
          bar={
            <>
              <span className="truncate">Results · Why surveys fail</span>
              <span className="inline-flex shrink-0 items-center gap-1.5 text-coral">
                <span className="size-1.5 rounded-full bg-coral motion-safe:animate-pulse" />
                LIVE
              </span>
            </>
          }
        >
          <div className="flex min-h-[26.5rem] flex-col">
            <div className="flex items-end justify-between gap-4 px-6 pt-6 sm:px-8">
              <div>
                <p className="text-sm text-ink/55">Responses</p>
                <p className="mt-1 flex items-center gap-2.5">
                  <span
                    key={HERO_BASE_RESPONSES + others + (done ? 1 : 0)}
                    className="font-display text-[2.25rem] leading-none tabular-nums text-ink motion-safe:animate-[live-bump_0.5s_ease-out]"
                  >
                    {HERO_BASE_RESPONSES + others + (done ? 1 : 0)}
                  </span>
                  {done && (
                    <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-medium text-white motion-safe:animate-[demo-step-in_0.35s_ease-out_both]">
                      +1 from you
                    </span>
                  )}
                </p>
              </div>
              <p className="pb-0.5 text-right font-mono text-[11px] text-ink/45">example data</p>
            </div>

            <ol className="mt-5 flex-1 border-t border-hairline">
              {HERO_ORDER.map((id) => {
                const q = HERO_STEPS[id];
                const row = shown[id];
                const max = Math.max(...row);
                const leader = q.options[row.indexOf(max)];
                const yours = mine(id);
                const skippedForYou = done && !history.includes(id);
                const open = focus === id;
                return (
                  <li key={id} className="border-b border-hairline last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setPeek(id)}
                      aria-expanded={open}
                      className="flex w-full items-baseline gap-3 px-6 py-3 text-left outline-none transition-colors hover:bg-surface/60 focus-visible:bg-surface/60 sm:px-8"
                    >
                      <span className="font-mono text-[11px] text-ink/40">{q.n}</span>
                      <span
                        className={`min-w-0 flex-1 truncate text-sm ${open ? "font-medium text-ink" : "text-ink/70"}`}
                      >
                        {open ? q.title : q.short}
                      </span>
                      {!open && (
                        <span className="shrink-0 truncate text-xs text-ink/50">
                          {yours ? (
                            <span className="font-medium text-brand">You: {yours}</span>
                          ) : skippedForYou ? (
                            "Skipped for you"
                          ) : (
                            leader
                          )}
                        </span>
                      )}
                    </button>
                    {open && (
                      <ul className="space-y-2.5 px-6 pb-4 sm:px-8">
                        {q.options.map((opt, i) => {
                          const you = yours === opt;
                          const lead = row[i] === max;
                          return (
                            <li key={opt}>
                              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                                <span
                                  className={`min-w-0 truncate ${you || lead ? "font-medium text-ink" : "text-ink/70"}`}
                                >
                                  {opt}
                                  {you && (
                                    <span className="ml-2 rounded-sm bg-brand px-1.5 py-px font-mono text-[10px] font-medium text-white uppercase">
                                      You
                                    </span>
                                  )}
                                </span>
                                <span className="font-mono text-xs tabular-nums text-ink/55">
                                  {row[i]}
                                </span>
                              </div>
                              <div className="mt-1 h-1.5 rounded-sm bg-surface">
                                <div
                                  className={`h-1.5 rounded-sm transition-[width,background-color] duration-700 ease-out ${
                                    you || (lead && !yours) ? "bg-brand" : "bg-ink/25"
                                  }`}
                                  style={{ width: `${(row[i] / max) * 100}%` }}
                                />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </Sheet>
      </figure>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Feature vignettes                                                        */
/* ------------------------------------------------------------------------ */

type DraftQ = { type: string; label: string };

const DRAFT_GOALS: Array<{ goal: string; questions: DraftQ[] }> = [
  {
    goal: "Why trial users don’t upgrade",
    questions: [
      { type: "Multiple choice", label: "What were you hoping Flowform would help you do?" },
      { type: "Dropdown", label: "Which plan did you look at?" },
      { type: "Long answer", label: "What would make upgrading an easy decision?" },
    ],
  },
  {
    goal: "Feedback after a workshop",
    questions: [
      { type: "Star rating", label: "How would you rate the workshop overall?" },
      { type: "Multiple choice", label: "Which session was most useful?" },
      { type: "Long answer", label: "What should we change next time?" },
    ],
  },
  {
    goal: "How the team is feeling",
    questions: [
      { type: "Star rating", label: "How manageable was your workload this month?" },
      { type: "Yes / No", label: "Do you feel your work is recognised?" },
      { type: "Long answer", label: "What’s one thing that would make next month better?" },
    ],
  },
];

/** Small "Claude" marker used wherever AI did the work. */
function ClaudeTag() {
  return <Tag tone="brand">Claude</Tag>;
}

/** Placeholder rows shown while Claude is "drafting". */
function DraftingRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-5 pt-1" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3 motion-safe:animate-pulse">
          <div className="size-6 shrink-0 rounded-full bg-surface" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-4 rounded-sm bg-surface" style={{ width: `${86 - i * 12}%` }} />
            <div className="h-3 w-20 rounded-sm bg-surface" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Goal in, questions out: pick a goal and watch Claude draft a form for it. */
function BuilderVignette() {
  const [goalIdx, setGoalIdx] = useState(0);
  const [drafting, setDrafting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const draft = (i: number) => {
    if (i === goalIdx) return;
    setGoalIdx(i);
    setDrafting(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDrafting(false), 900);
  };
  const { questions } = DRAFT_GOALS[goalIdx];

  return (
    <Sheet bar={<span className="truncate">New form · Draft with Claude</span>}>
      <div className="p-5 sm:p-6">
        <p className="text-sm text-ink/55">1. Pick what you want to learn</p>
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Example goals">
          {DRAFT_GOALS.map((g, i) => (
            <button
              key={g.goal}
              type="button"
              role="radio"
              aria-checked={i === goalIdx}
              onClick={() => draft(i)}
              className={`rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
                i === goalIdx
                  ? "border-brand bg-accent font-medium text-ink"
                  : "border-hairline bg-card text-ink/60 hover:border-ink/30"
              }`}
            >
              {g.goal}
            </button>
          ))}
        </div>

        <div className="mt-7 flex items-center gap-2">
          <p className="text-sm text-ink/55" aria-live="polite">
            {drafting ? "2. Claude is writing your questions…" : "2. Claude writes the questions"}
          </p>
          <ClaudeTag />
        </div>

        <div className="mt-4 min-h-[13rem]">
          {drafting ? (
            <DraftingRows />
          ) : (
            <ol className="space-y-5">
              {questions.map((q, i) => (
                <li
                  key={`${goalIdx}-${i}`}
                  className="flex gap-3 motion-safe:animate-[demo-step-in_0.35s_ease-out_both]"
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <span className="mt-px inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-surface font-mono text-[11px] text-ink/55">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] leading-snug text-ink">{q.label}</p>
                    <p className="mt-1 text-xs text-ink/45">{q.type}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Sheet>
  );
}

/** Each answer to the first question decides which later questions apply. */
const ROUTE_ANSWERS: Array<{ answer: string; skips: number[] }> = [
  { answer: "A friend or colleague", skips: [] },
  { answer: "Search", skips: [0] },
  { answer: "Just browsing", skips: [0, 1, 2] },
];
const ROUTE_NEXT = [
  "Who told you about us?",
  "What were you looking for?",
  "Did you find it?",
  "Anything else?",
];

/** Pick an answer and see which questions that person is spared. */
function LogicVignette() {
  const [picked, setPicked] = useState(2);
  const { skips } = ROUTE_ANSWERS[picked];
  const left = ROUTE_NEXT.length - skips.length;

  return (
    <Sheet bar={<span className="truncate">Trial feedback · What each person sees</span>}>
      <div className="p-5 sm:p-6">
        <p className="text-sm text-ink/55">Someone answers</p>
        <p className="mt-1.5 font-display text-xl leading-tight text-ink">How did you find us?</p>
        <div className="mt-4 grid gap-2" role="radiogroup" aria-label="How did you find us?">
          {ROUTE_ANSWERS.map((r, i) => {
            const active = i === picked;
            return (
              <button
                key={r.answer}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setPicked(i)}
                className={`flex items-center gap-3 rounded-md border px-3 py-2 text-left text-[14px] transition-colors ${
                  active
                    ? "border-brand bg-accent text-ink"
                    : "border-hairline bg-card text-ink/70 hover:border-ink/25"
                }`}
              >
                <span
                  className={`grid size-4 shrink-0 place-items-center rounded-full border ${
                    active ? "border-brand" : "border-ink/25"
                  }`}
                >
                  {active && <span className="size-2 rounded-full bg-brand" />}
                </span>
                {r.answer}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex items-baseline justify-between gap-3">
          <p className="text-sm text-ink/55">So they’re asked</p>
          <p className="font-mono text-[11px] text-ink/45" aria-live="polite">
            {left} of {ROUTE_NEXT.length} questions
          </p>
        </div>
        <ol className="mt-3 space-y-2">
          {ROUTE_NEXT.map((q, i) => {
            const skipped = skips.includes(i);
            return (
              <li
                key={q}
                className={`flex items-center gap-3 rounded-md border px-3 py-2 text-[14px] transition-all duration-300 ${
                  skipped
                    ? "border-dashed border-ink/15 text-ink/35"
                    : "border-hairline bg-surface/70 text-ink"
                }`}
              >
                <span className={skipped ? "line-through decoration-ink/25" : ""}>{q}</span>
                {skipped && <span className="ml-auto shrink-0 text-xs text-ink/45">skipped</span>}
              </li>
            );
          })}
        </ol>
      </div>
    </Sheet>
  );
}

const SUMMARY_THEMES: Array<{ name: string; share: number }> = [
  { name: "Annual billing feels like a big jump", share: 46 },
  { name: "Missing Slack and HubSpot", share: 31 },
  { name: "Setup took longer than expected", share: 18 },
];

const ASK_EXAMPLES: Array<{ q: string; a: string; basis: string }> = [
  {
    q: "What do unhappy customers mention?",
    a: "Price first, then setup. People who rated you 6 or lower mention annual billing three times as often as everyone else.",
    basis: "Based on 38 responses",
  },
  {
    q: "Who is closest to upgrading?",
    a: "Small teams. They rate the product highest and ask for one thing: a monthly plan.",
    basis: "Based on 61 responses",
  },
  {
    q: "What changed this week?",
    a: "Setup complaints halved after Tuesday. Mentions of Slack went up.",
    basis: "Based on 44 responses",
  },
];

/** Claude's reading of the open answers, and a question box that answers back. */
function InsightVignette() {
  const [asked, setAsked] = useState(0);
  const ask = ASK_EXAMPLES[asked];

  return (
    <Sheet bar={<span className="truncate">Results · Trial feedback</span>}>
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <p className="text-sm text-ink/55">Claude read 214 answers</p>
          <ClaudeTag />
        </div>
        <p className="mt-3 font-display text-xl leading-snug text-balance text-ink sm:text-2xl">
          People like the product, but most stall at pricing.
        </p>

        <ol className="mt-6 space-y-3.5">
          {SUMMARY_THEMES.map((t) => (
            <li key={t.name}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[14px] text-ink">{t.name}</p>
                <span className="font-mono text-sm tabular-nums text-ink/55">{t.share}%</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-sm bg-surface">
                <div className="h-1.5 rounded-sm bg-brand" style={{ width: `${t.share}%` }} />
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="border-t border-hairline bg-paper p-5 sm:p-6">
        <p className="text-sm text-ink/55">Then ask it anything</p>
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Example questions">
          {ASK_EXAMPLES.map((e, i) => (
            <button
              key={e.q}
              type="button"
              role="radio"
              aria-checked={i === asked}
              onClick={() => setAsked(i)}
              className={`rounded-full border px-3 py-1.5 text-left text-[13px] transition-colors ${
                i === asked
                  ? "border-brand bg-accent font-medium text-ink"
                  : "border-hairline bg-card text-ink/60 hover:border-ink/30"
              }`}
            >
              {e.q}
            </button>
          ))}
        </div>
        <div
          key={asked}
          aria-live="polite"
          className="mt-4 min-h-[5.5rem] motion-safe:animate-[demo-step-in_0.35s_ease-out_both]"
        >
          <p className="text-[15px] leading-relaxed text-ink">{ask.a}</p>
          <p className="mt-1.5 font-mono text-[11px] text-ink/45">{ask.basis}</p>
        </div>
      </div>
    </Sheet>
  );
}

const LIVE_OPTIONS = ["Pricing pages", "Onboarding emails", "Customer interviews", "Churn"];
const LIVE_START = [14, 9, 21, 6];

/**
 * Presenter view: a live poll on the big screen. Answers "arrive" on a timer
 * so the bars move like the real Realtime view; still for reduced motion.
 */
function LiveVignette() {
  const [counts, setCounts] = useState(LIVE_START);
  const [bumped, setBumped] = useState<number | null>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      // Weighted toward the leader, so the race stays readable.
      const i = Math.random() < 0.45 ? 2 : Math.floor(Math.random() * LIVE_START.length);
      setBumped(i);
      setCounts((c) =>
        c.reduce((a, b) => a + b, 0) >= 120 ? LIVE_START : c.map((n, j) => (j === i ? n + 1 : n)),
      );
    }, 1300);
    return () => clearInterval(t);
  }, []);
  const total = counts.reduce((a, b) => a + b, 0);
  const max = Math.max(...counts);

  return (
    <Sheet
      bar={
        <>
          <span className="truncate">Live results · Growth workshop</span>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-coral">
            <span className="size-1.5 rounded-full bg-coral motion-safe:animate-pulse" />
            LIVE
          </span>
        </>
      }
    >
      <div className="px-5 py-5 sm:px-6">
        <p className="font-mono text-[11px] text-ink/45">
          <span className="text-brand">02</span> / 04
        </p>
        <p className="mt-1.5 font-display text-xl leading-snug text-ink">
          Which topic should we cover next?
        </p>
        <ul className="mt-4 space-y-3">
          {LIVE_OPTIONS.map((o, i) => (
            <li key={o}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className={counts[i] === max ? "font-medium text-ink" : "text-ink/75"}>
                  {o}
                </span>
                <span
                  key={bumped === i ? counts[i] : undefined}
                  className="font-mono text-xs tabular-nums text-ink/55 motion-safe:animate-[demo-step-in_0.35s_ease-out_both]"
                >
                  {counts[i]}
                </span>
              </div>
              <div className="mt-1.5 h-2 rounded-sm bg-surface">
                <div
                  className={`h-2 rounded-sm transition-[width] duration-700 ease-out ${counts[i] === max ? "bg-brand" : "bg-ink/25"}`}
                  style={{ width: `${(counts[i] / total) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center gap-4 border-t border-hairline bg-paper px-5 py-4 sm:px-6">
        <div className="shrink-0 rounded-md border border-hairline bg-white p-1.5">
          <QRCode value="https://flowformapp.vercel.app/demo" size={56} fgColor="#1b1c22" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">Scan to answer</p>
          <p className="truncate font-mono text-[11px] text-ink/50">
            flowformapp.vercel.app/f/growth
          </p>
        </div>
        <p className="ml-auto shrink-0 text-right font-mono text-[11px] text-ink/50">
          <span className="block text-lg font-medium tabular-nums text-ink">{total}</span>
          answers
        </p>
      </div>
    </Sheet>
  );
}

const WALL_WIDTHS = [72, 54, 88, 61, 80, 47, 69, 90, 58, 76, 51, 84, 63];

/**
 * The problem in one picture: a classic survey's wall of questions, with the
 * place the tab gets closed, next to the one question a Flowform shows.
 * Sits on the ink band, so it uses paper tones only.
 */
function WallVignette() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-xl border border-paper/15 p-5">
        <p className="text-sm text-paper/55">A classic survey</p>
        <ol
          aria-hidden
          className="mt-4 max-h-72 space-y-2.5 overflow-hidden [mask-image:linear-gradient(to_bottom,black_62%,transparent)]"
        >
          {WALL_WIDTHS.map((w, i) => (
            <li key={i}>
              <div className="flex items-center gap-2.5">
                <span className="w-4 shrink-0 text-right font-mono text-[10px] text-paper/35">
                  {i + 1}
                </span>
                <span
                  className={`h-2 rounded-sm ${i < 8 ? "bg-paper/30" : "bg-paper/12"}`}
                  style={{ width: `${w}%` }}
                />
              </div>
              {i === 7 && (
                <div className="mt-2.5 flex items-center gap-2 font-mono text-[10px] text-paper/70">
                  <span className="h-px flex-1 border-t border-dashed border-paper/40" />
                  tab closed here
                  <span className="h-px w-4 border-t border-dashed border-paper/40" />
                </div>
              )}
            </li>
          ))}
        </ol>
        <p className="mt-2 font-mono text-[11px] text-paper/45">…and 27 more questions</p>
      </div>

      <div className="flex flex-col rounded-xl bg-paper p-5 text-ink">
        <p className="text-sm text-ink/55">A Flowform</p>
        <div className="mt-4 h-1 rounded-full bg-ink/10">
          <div className="h-1 w-2/5 rounded-full bg-brand" />
        </div>
        <p className="mt-5 font-display text-xl leading-tight">How was the workshop?</p>
        <div aria-hidden className="mt-4 grid gap-2">
          {["Worth the afternoon", "Fine", "Could have been an email"].map((o, i) => (
            <div
              key={o}
              className={`flex items-center gap-2.5 rounded-md border px-3 py-2 text-[14px] ${
                i === 0 ? "border-brand bg-accent" : "border-hairline bg-card text-ink/70"
              }`}
            >
              <span
                className={`grid size-5 shrink-0 place-items-center rounded-sm border font-mono text-[10px] ${
                  i === 0 ? "border-brand bg-brand text-white" : "border-ink/15 text-ink/50"
                }`}
              >
                {String.fromCharCode(65 + i)}
              </span>
              {o}
            </div>
          ))}
        </div>
        <p className="mt-auto pt-4 font-mono text-[11px] text-ink/45">
          One question. Then the next one.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Content                                                                  */
/* ------------------------------------------------------------------------ */

const HERO_FACTS: Array<{ icon: LucideIcon; title: string; href?: string }> = [
  { icon: Gift, title: "Free to use" },
  { icon: UserRoundX, title: "No sign-up" },
  { icon: Code2, title: "Open source", href: REPO_URL },
];

const FEATURES: Array<{
  hue: Hue;
  glyph: Glyph;
  note?: string;
  label: string;
  title: React.ReactNode;
  body: string;
  points: string[];
  visual: React.ReactNode;
}> = [
  {
    hue: "sun",
    glyph: "build",
    note: "Drafted by Claude",
    label: "Build",
    title: (
      <>
        Start from a goal, <em>not</em> a blank page.
      </>
    ),
    body: "Tell Claude what you want to learn. It drafts the questions, picks the types and writes the options. You keep the good ones.",
    points: [
      "Five to eight questions, ready to edit",
      "One gentle “why?” after a vague answer",
      "Your colour, font and cover image",
    ],
    visual: <BuilderVignette />,
  },
  {
    hue: "coral",
    glyph: "branch",
    label: "Branch",
    title: (
      <>
        Skip what doesn’t <em>apply.</em>
      </>
    ),
    body: "People only see the questions that fit their answers. Nobody gets asked about a team they don’t have. Click an answer to see it.",
    points: [
      "Jump ahead based on any answer",
      "Reuse earlier answers: “Thanks, Sam. What brought you here?”",
      "One question at a time, or all on one page",
    ],
    visual: <LogicVignette />,
  },
  {
    hue: "mint",
    glyph: "learn",
    note: "Summaries by Claude",
    label: "Learn",
    title: (
      <>
        Know what people <em>really think.</em>
      </>
    ),
    body: "Claude reads every open answer and sums them up in a few themes. You read one summary, not 214 replies.",
    points: [
      "Ask “What do unhappy customers mention?”",
      "See the exact question where people quit",
      "Export a CSV or a PDF report",
    ],
    visual: <InsightVignette />,
  },
  {
    hue: "sky",
    glyph: "present",
    note: "Live results",
    label: "Present",
    title: (
      <>
        Turn any form into a <em>live poll.</em>
      </>
    ),
    body: "Put the results on the big screen. People scan, answer on their phones and watch the bars move. A meeting with a measurable outcome, at last.",
    points: [
      "Updates live, no refreshing",
      "QR code and short link on screen",
      "Hide the count until the reveal",
    ],
    visual: <LiveVignette />,
  },
];

type Capability = { icon: LucideIcon; title: string; body: string };

const AI_CAPABILITIES: Capability[] = [
  { icon: Lightbulb, title: "Drafts your questions", body: "Describe a goal, get a ready form." },
  {
    icon: MessagesSquare,
    title: "Asks a follow-up",
    body: "One gentle “why?” after a vague answer.",
  },
  { icon: Quote, title: "Reads every answer", body: "Themes, mood and quotes in seconds." },
  { icon: Search, title: "Answers your questions", body: "Ask your results in plain English." },
];

const CAPABILITIES: Capability[] = [
  {
    icon: TrendingDown,
    title: "See where people quit",
    body: "The exact question they stopped on.",
  },
  { icon: Trophy, title: "Quizzes with a score", body: "Points and a result at the end." },
  { icon: Palette, title: "Your brand", body: "Your colour, font and cover image." },
  { icon: Signpost, title: "Traffic sources", body: "Newsletter, social post or website." },
  { icon: Layers, title: "Safe edits", body: "New versions keep the old answers." },
  { icon: Users, title: "Team roles", body: "Admins, editors and viewers." },
  { icon: QrCode, title: "Share anywhere", body: "Link, QR code or embed." },
  { icon: Download, title: "Export", body: "Spreadsheet, CSV or PDF report." },
];

function CapabilityList({ items, tone }: { items: Capability[]; tone: string }) {
  return (
    <ul className="mt-6 grid gap-x-10 gap-y-6 sm:grid-cols-2">
      {items.map(({ icon: Icon, title, body }) => (
        <li key={title} className="flex gap-3">
          <Icon className={`mt-0.5 size-5 shrink-0 ${tone}`} strokeWidth={1.75} />
          <div>
            <h3 className="text-[15px] font-medium tracking-normal text-paper">{title}</h3>
            <p className="mt-0.5 text-sm text-paper/55">{body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "Is Flowform free?",
    a: "Yes, while it’s in early access. Every feature, no credit card.",
  },
  {
    q: "Do respondents need an account?",
    a: "No. They open a link, scan a QR code or find the form on your site, and start answering. The world has enough passwords.",
  },
  {
    q: "How do the AI features work?",
    a: "Claude drafts questions you can keep or edit. Later, it reads the open answers and returns themes, mood and quotes. Anything Claude wrote is labelled.",
  },
  {
    q: "Can I use it at a live event?",
    a: "Yes. Put the live results on a projector. People scan the QR code, answer on their phones, and the bars move as answers arrive.",
  },
  {
    q: "Can I change a form after people have answered?",
    a: "Yes. Start a new version. Old responses stay put, new visitors see the update, and you can compare the two.",
  },
  {
    q: "How is this different from a classic survey?",
    a: "A classic survey is a wall of questions and a quiet hope. Flowform asks one at a time, skips what doesn’t apply and shows exactly where people stop.",
  },
  {
    q: "Where is my data stored?",
    a: "In a Postgres database on Supabase. Row-level security means only you and the teammates you invite can read your forms and responses. We don’t sell or share it.",
  },
];

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#faq", label: "FAQ" },
];

/* ------------------------------------------------------------------------ */
/* Page                                                                     */
/* ------------------------------------------------------------------------ */

function SiteHeader() {
  const { session } = useAuth();
  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-paper/85 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 md:px-8">
        <a href="/" aria-label="Flowform home" className="shrink-0">
          <Logo />
        </a>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="hidden items-center md:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-md px-3 py-2 text-sm text-ink/60 transition-colors hover:text-ink"
              >
                {l.label}
              </a>
            ))}
            <Link
              to="/demo"
              className="rounded-md px-3 py-2 text-sm text-ink/60 transition-colors hover:text-ink"
            >
              Demo
            </Link>
          </div>
          <span className="mx-2 hidden h-5 w-px bg-hairline md:block" />
          {session ? (
            <>
              <Link
                to="/dashboard"
                className="rounded-md px-3 py-2 text-sm whitespace-nowrap text-ink/70 transition-colors hover:text-ink"
              >
                Dashboard
              </Link>
              <UserMenu userId={session.user.id} email={session.user.email ?? ""} />
            </>
          ) : (
            <>
              <Link
                to="/login"
                search={{ redirect: "/dashboard" }}
                className="rounded-md px-3 py-2 text-sm whitespace-nowrap text-ink/70 transition-colors hover:text-ink"
              >
                Log in
              </Link>
              <PrimaryCTA size="sm">Get started</PrimaryCTA>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

function Index() {
  const { session } = useAuth();
  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />

      <main>
        {/* Hero: the promise, then the product doing it */}
        <section className="px-4 pt-12 pb-20 sm:px-6 md:px-8 lg:pb-28">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-card py-1 pr-3 pl-1.5 text-sm text-ink/70">
                <span className="rounded-full bg-mint-tint px-2 py-0.5 text-xs font-medium text-mint">
                  New
                </span>
                Live polls, quizzes and “Ask your results”
              </span>
              <h1 className="mt-6 font-display text-[2.8rem] leading-[1.02] text-balance text-ink sm:text-6xl lg:text-[4.75rem]">
                Forms people actually <em className="text-brand">finish.</em>
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-balance text-ink/65">
                One question at a time, nothing that doesn’t apply. Claude drafts the questions and
                reads the answers. The 40-question survey can rest in peace.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <PrimaryCTA>{session ? "Open dashboard" : "Start free"}</PrimaryCTA>
                <Link
                  to="/demo"
                  className="inline-flex h-12 items-center gap-2 rounded-md border border-ink/15 bg-card px-5 text-[15px] font-medium text-ink transition-colors hover:border-ink/35"
                >
                  Try the demo
                </Link>
              </div>
              <ul className="mt-7 flex flex-wrap justify-center gap-x-8 gap-y-3">
                {HERO_FACTS.map(({ icon: Icon, title, href }) => (
                  <li key={title} className="flex items-center gap-2.5">
                    <Icon className="size-5 shrink-0 text-brand" strokeWidth={2} />
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[15px] font-semibold text-ink transition-colors hover:text-brand"
                      >
                        {title}
                      </a>
                    ) : (
                      <span className="text-[15px] font-semibold text-ink">{title}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mx-auto mt-12 max-w-5xl">
              <HeroDemo />
            </div>
          </div>
        </section>

        {/* Why: the wall of questions, and the alternative */}
        <section className="bg-ink px-4 py-20 text-paper sm:px-6 md:px-8 md:py-24">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-20 [&>*]:min-w-0">
            <div>
              <h2 className="font-display text-[2.2rem] leading-[1.02] text-balance md:text-[2.8rem]">
                Nobody finishes <em>a wall of questions.</em>
              </h2>
              <p className="mt-6 max-w-md text-[17px] leading-relaxed text-paper/65">
                A classic survey shows everything at once and hopes for the best. Flowform asks one
                thing at a time, skips what doesn’t apply, and shows you the exact question where
                people stop.
              </p>
            </div>
            <WallVignette />
          </div>
        </section>

        {/* Features */}
        <section id="how-it-works" className="border-t border-hairline">
          {FEATURES.map((f, i) => (
            <div
              key={f.label}
              className={`px-4 py-20 sm:px-6 md:px-8 md:py-28 ${i > 0 ? "border-t border-hairline" : ""}`}
            >
              <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-20 [&>*]:min-w-0">
                <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                  <SectionMark kind={f.glyph} hue={f.hue} label={f.label} note={f.note} />
                  <h2 className="mt-5 font-display text-[2.2rem] leading-[1.02] text-balance text-ink md:text-[2.8rem]">
                    {f.title}
                  </h2>
                  <p className="mt-6 max-w-md text-[17px] leading-relaxed text-ink/65">{f.body}</p>
                  <ul className="mt-8 max-w-md divide-y divide-hairline border-y border-hairline">
                    {f.points.map((p) => (
                      <li key={p} className="flex items-center gap-3 py-3 text-[15px] text-ink/80">
                        <span className={`size-1.5 rounded-full ${HUE[f.hue].dot}`} />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <Stage hue={f.hue} className={i % 2 === 1 ? "lg:order-1" : ""}>
                  {f.visual}
                </Stage>
              </div>
            </div>
          ))}
        </section>

        {/* Features: what people can do with Flowform */}
        <section id="features" className="bg-ink px-4 py-20 text-paper sm:px-6 md:px-8 md:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
              <div>
                <h2 className="font-display text-[2.2rem] leading-[1.02] text-balance md:text-[2.8rem]">
                  Everything a form needs. <em>Nothing it doesn’t.</em>
                </h2>
                <p className="mt-6 max-w-sm text-[17px] leading-relaxed text-paper/60">
                  Claude drafts, follows up and reads. The rest takes a click.
                </p>
                <div className="mt-8">
                  <Link
                    to="/demo"
                    className="inline-flex h-11 items-center gap-2 rounded-md bg-paper px-4 text-sm font-medium text-ink transition-colors hover:bg-card"
                  >
                    Try the demo
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              </div>
              <div className="space-y-12">
                <div>
                  <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wide text-[oklch(0.78_0.12_255)]">
                    Done by Claude
                  </p>
                  <CapabilityList items={AI_CAPABILITIES} tone="text-[oklch(0.78_0.12_255)]" />
                </div>
                <div className="border-t border-paper/15 pt-10">
                  <p className="font-mono text-[11px] uppercase tracking-wide text-paper/45">
                    Built in
                  </p>
                  <CapabilityList items={CAPABILITIES} tone="text-paper/60" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="px-4 py-20 sm:px-6 md:px-8 md:py-28">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
            <div>
              <h2 className="font-display text-[2.2rem] leading-[1.02] text-balance md:text-[2.8rem]">
                Before your <em>first form.</em>
              </h2>
            </div>
            <Accordion type="single" collapsible className="border-t border-hairline">
              {FAQS.map(({ q, a }) => (
                <AccordionItem key={q} value={q} className="border-hairline">
                  <AccordionTrigger className="py-5 text-left text-[17px] font-medium text-ink hover:no-underline">
                    {q}
                  </AccordionTrigger>
                  <AccordionContent className="pb-6 text-[15px] leading-relaxed text-ink/65">
                    {a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Closing CTA + pricing */}
        <section className="px-4 pb-20 sm:px-6 md:px-8 md:pb-28">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-brand px-6 py-14 text-paper sm:px-12 md:py-20">
            <div className="relative flex flex-col items-start justify-between gap-10 lg:flex-row lg:items-center">
              <div>
                <h2 className="font-display text-[2.5rem] leading-[1.02] text-balance md:text-[3.8rem]">
                  Ask one good question
                  <br />
                  <em>at a time.</em>
                </h2>
                <p className="mt-6 max-w-md text-[17px] text-paper/75">
                  Free in early access. Every feature, no credit card.
                </p>
              </div>
              {/* The page ends the way a Flowform does: one question. */}
              <div className="w-full max-w-sm shrink-0 rounded-xl bg-paper p-5 text-ink shadow-[0_30px_60px_-30px_rgb(0_0_0/0.45)]">
                <p className="font-mono text-xs text-ink/50">
                  <span className="text-brand">01</span>
                  <span className="mx-1.5 text-ink/25">/</span>
                  01
                </p>
                <p className="mt-1.5 font-display text-xl leading-tight">
                  {session ? "Back to your forms?" : "Ready to make your first form?"}
                </p>
                <div className="mt-4 grid gap-2">
                  <Link
                    to={session ? "/dashboard" : "/signup"}
                    data-cta="get-started"
                    className="group flex items-center gap-3 rounded-md border border-brand bg-accent px-3 py-2.5 text-[15px] font-medium text-ink transition-colors hover:bg-brand hover:text-white"
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-sm border border-brand bg-brand font-mono text-[11px] text-white group-hover:border-white/60">
                      A
                    </span>
                    <span className="flex-1">
                      {session ? "Yes, open my dashboard" : "Yes, start free"}
                    </span>
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  <Link
                    to="/demo"
                    className="flex items-center gap-3 rounded-md border border-hairline bg-card px-3 py-2.5 text-[15px] text-ink/75 transition-colors hover:border-ink/30 hover:text-ink"
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-sm border border-ink/15 font-mono text-[11px] text-ink/50">
                      B
                    </span>
                    <span className="flex-1">Show me the demo first</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-hairline px-4 py-10 sm:px-6 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <Logo />
            <p className="text-sm text-ink/50">
              <BuiltBy />
            </p>
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink/55">
            <li>
              <Link to="/demo" className="transition-colors hover:text-ink">
                Demo
              </Link>
            </li>
            <li>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-ink"
              >
                GitHub
              </a>
            </li>
            <li>
              <Link to="/privacy" className="transition-colors hover:text-ink">
                Privacy
              </Link>
            </li>
            <li>
              <Link to="/terms" className="transition-colors hover:text-ink">
                Terms
              </Link>
            </li>
            <li className="font-mono text-[12px] text-ink/40">© {new Date().getFullYear()}</li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
