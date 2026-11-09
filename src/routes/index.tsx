import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CornerDownLeft,
  Download,
  History,
  Lightbulb,
  ListChecks,
  Power,
  QrCode,
  Quote,
  RotateCcw,
  Rows3,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { UserMenu } from "@/components/user-menu";
import { Logo } from "@/components/logo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
    tone === "ink" ? "bg-ink text-paper hover:bg-ink/85" : "bg-paper text-ink hover:bg-white";
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

type Glyph = "build" | "branch" | "learn";

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
      className={`overflow-hidden rounded-xl border border-hairline bg-white shadow-[0_1px_0_rgb(0_0_0/0.03),0_30px_60px_-30px_rgb(20_22_30/0.22)] ${className}`}
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
/* Hero vignette — a respondent mid-form, with the logic rule annotated     */
/* ------------------------------------------------------------------------ */

type HeroStepId = "blocker" | "integration" | "plan";

const HERO_STEPS: Record<HeroStepId, { n: number; title: string; options: string[] }> = {
  blocker: {
    n: 1,
    title: "What almost stopped you from signing up?",
    options: ["Pricing", "Setup time", "Missing integrations", "Nothing, really"],
  },
  integration: {
    n: 2,
    title: "Which integration were you missing?",
    options: ["Slack", "Notion", "HubSpot", "Zapier"],
  },
  plan: {
    n: 3,
    title: "Which plan would fit your team?",
    options: ["Just me", "A small team", "The whole company", "Not sure yet"],
  },
};
const HERO_TOTAL = 3;
const HERO_SHORT: Record<HeroStepId, string> = {
  blocker: "What almost stopped you",
  integration: "Missing integration",
  plan: "Plan that fits",
};

/** The one jump rule in the example form: only "Missing integrations" asks Q2. */
function heroNext(step: HeroStepId, answer: string | undefined): HeroStepId | "done" {
  if (step === "blocker") return answer === "Missing integrations" ? "integration" : "plan";
  if (step === "integration") return "plan";
  return "done";
}

/**
 * A working, three-question Flowform: click or use A–D and Enter, go back,
 * and watch the logic jump skip Q2 unless the respondent picks
 * "Missing integrations". Nothing is stored.
 */
function HeroForm() {
  const [step, setStep] = useState<HeroStepId | "done">("blocker");
  const [answers, setAnswers] = useState<Partial<Record<HeroStepId, string>>>({
    blocker: "Pricing",
  });
  const [history, setHistory] = useState<HeroStepId[]>([]);

  // Moving between steps unmounts the focused OK button, which would drop focus
  // to <body> and kill the keyboard shortcuts. Once the visitor has used the
  // form, keep focus on it (never on first load, so the page isn't hijacked).
  const figureRef = useRef<HTMLElement>(null);
  const engaged = useRef(false);
  useEffect(() => {
    if (engaged.current) figureRef.current?.focus({ preventScroll: true });
  }, [step]);

  const current = step === "done" ? null : HERO_STEPS[step];
  const picked = step === "done" ? undefined : answers[step];
  const skippedQ2 = history.length > 0 && !history.includes("integration") && step !== "blocker";
  const progress = step === "done" ? 1 : (current!.n - 1) / HERO_TOTAL;

  const pick = (opt: string) => {
    if (step === "done") return;
    setAnswers((a) => ({ ...a, [step]: opt }));
  };
  const advance = () => {
    if (step === "done" || !picked) return;
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
    setAnswers({ blocker: "Pricing" });
    setHistory([]);
    setStep("blocker");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Enter") {
      e.preventDefault();
      if (step === "done") restart();
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

  // A plain-language hint under the form: how it adapts, in respondent terms.
  let note: React.ReactNode = null;
  if (step === "blocker") {
    note =
      picked === "Missing integrations"
        ? "You’ll get one follow-up question about integrations."
        : "Tip: pick “Missing integrations” and the form adds a follow-up question.";
  } else if (step === "plan" && skippedQ2) {
    note = "One question was skipped because it didn’t apply to you.";
  }

  return (
    <figure
      ref={figureRef}
      tabIndex={-1}
      className="relative outline-none"
      onKeyDown={onKeyDown}
      onPointerDown={() => (engaged.current = true)}
      onFocus={() => (engaged.current = true)}
    >
      <Sheet
        bar={
          <>
            <span className="truncate">flowformapp.vercel.app/f/trial-feedback</span>
            <span className="shrink-0">
              {step === "done" ? "Done" : `${current!.n} / ${HERO_TOTAL}`}
            </span>
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
            className="min-h-[27rem] px-6 pt-7 pb-7 motion-safe:animate-[demo-step-in_0.35s_ease-out_both] sm:px-9 sm:pt-8"
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
            <h3 className="mt-2 font-display text-[2rem] leading-[1.08] text-ink sm:text-[2.4rem]">
              {current.title}
            </h3>
            <ul className="mt-6 grid gap-2" role="radiogroup" aria-label={current.title}>
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
                          : "border-hairline bg-white text-ink/75 hover:border-ink/25"
                      }`}
                    >
                      <span
                        className={`grid size-6 shrink-0 place-items-center rounded-sm border font-mono text-[11px] ${
                          active ? "border-brand bg-brand text-white" : "border-ink/15 text-ink/50"
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
            <div className="mt-6 flex items-center gap-4">
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
          <div className="min-h-[27rem] px-6 pt-8 pb-7 motion-safe:animate-[demo-step-in_0.35s_ease-out_both] sm:px-9">
            <p className="inline-flex items-center gap-1.5 text-sm font-medium text-mint">
              <Check className="size-4" strokeWidth={2.5} /> Response recorded (not really)
            </p>
            <h3 className="mt-3 font-display text-[2.4rem] leading-[1.05] text-ink">
              That was a Flowform.
            </h3>
            <ol className="mt-5 divide-y divide-hairline border-y border-hairline text-[15px]">
              {(Object.keys(HERO_STEPS) as HeroStepId[]).map((id) => {
                const skipped = !history.includes(id);
                return (
                  <li key={id} className="flex items-baseline justify-between gap-4 py-2.5">
                    <span className={skipped ? "text-ink/40" : "text-ink/60"}>
                      {HERO_SHORT[id]}
                    </span>
                    <span className={`text-right ${skipped ? "text-ink/40 italic" : "text-ink"}`}>
                      {skipped ? "Not asked, didn’t apply" : answers[id]}
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={restart}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-input bg-white px-4 text-sm font-medium text-ink transition-colors hover:border-ink/35"
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

      {/* Slot reserved so steps without a hint don't make the layout jump. */}
      <figcaption
        aria-live="polite"
        className="mt-4 min-h-[1.5rem] px-1 text-sm leading-relaxed text-ink/60 transition-opacity duration-300"
        style={{ opacity: note ? 1 : 0 }}
      >
        {note}
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------------ */
/* Feature vignettes                                                        */
/* ------------------------------------------------------------------------ */

type DraftQ = { type: string; label: string; options?: string[] };

const DRAFT_GOALS: Array<{ goal: string; questions: DraftQ[] }> = [
  {
    goal: "Why trial users don’t upgrade",
    questions: [
      {
        type: "Multiple choice",
        label: "What were you hoping Flowform would help you do?",
        options: ["Collect feedback", "Run research", "Qualify leads"],
      },
      { type: "NPS", label: "How likely are you to recommend Flowform to a colleague?" },
      {
        type: "Dropdown",
        label: "Which plan did you look at?",
        options: ["Free", "Team", "Business"],
      },
      { type: "Long answer", label: "What would make upgrading an easy decision?" },
    ],
  },
  {
    goal: "Feedback after a workshop",
    questions: [
      { type: "Rating · 5 stars", label: "How would you rate the workshop overall?" },
      {
        type: "Multiple choice",
        label: "Which sessions were most useful?",
        options: ["Hands-on lab", "Panel", "Open Q&A"],
      },
      { type: "Yes / No", label: "Would you come to the next one?" },
      { type: "Long answer", label: "What should we change next time?" },
    ],
  },
  {
    goal: "How the team is feeling",
    questions: [
      { type: "Rating · 5 stars", label: "How manageable was your workload this month?" },
      { type: "Yes / No", label: "Do you feel your work is recognised?" },
      { type: "NPS", label: "How likely are you to recommend the team as a place to work?" },
      { type: "Long answer", label: "What’s one thing that would make next month better?" },
    ],
  },
];

/** Small "Claude" marker used wherever AI did the work. */
function ClaudeTag() {
  return <Tag tone="brand">Claude</Tag>;
}

/** Placeholder rows shown while Claude is "drafting" / "reading". */
function DraftingRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4 py-4" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2 motion-safe:animate-pulse">
          <div className="h-3.5 w-20 rounded-sm bg-surface" />
          <div className="h-4 rounded-sm bg-surface" style={{ width: `${88 - i * 14}%` }} />
        </div>
      ))}
    </div>
  );
}

/** Lets a visitor pick a goal and watch Claude draft typed questions for it. */
function BuilderVignette() {
  const [goalIdx, setGoalIdx] = useState(0);
  const [drafting, setDrafting] = useState(false);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const draft = (i: number) => {
    setGoalIdx(i);
    setAdded({});
    setDrafting(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDrafting(false), 1100);
  };
  const { goal, questions } = DRAFT_GOALS[goalIdx];

  return (
    <Sheet
      bar={
        <>
          <span className="truncate">New form · Draft with Claude</span>
          <span className="shrink-0">Example output</span>
        </>
      }
    >
      <div className="p-5 sm:p-6">
        <p className="text-sm font-medium text-ink/70">What do you want to learn?</p>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Example goals">
          {DRAFT_GOALS.map((g, i) => (
            <button
              key={g.goal}
              type="button"
              role="radio"
              aria-checked={i === goalIdx}
              onClick={() => draft(i)}
              className={`rounded-full border px-3 py-1 text-[13px] transition-colors ${
                i === goalIdx
                  ? "border-brand bg-accent text-ink"
                  : "border-hairline bg-white text-ink/65 hover:border-ink/30"
              }`}
            >
              {g.goal}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="min-w-0 flex-1 truncate rounded-md border border-input bg-surface px-3 py-2.5 text-[15px] text-ink">
            {goal}
          </div>
          <button
            type="button"
            onClick={() => draft(goalIdx)}
            disabled={drafting}
            className="inline-flex h-[2.65rem] shrink-0 items-center gap-1.5 rounded-md bg-brand px-3.5 text-sm font-medium text-white transition-colors hover:bg-brand/90 disabled:opacity-60"
          >
            {drafting ? (
              "Drafting…"
            ) : (
              <>
                <RotateCcw className="size-3.5" /> Redraft
              </>
            )}
          </button>
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-hairline pt-4">
          <p className="text-sm text-ink/60" aria-live="polite">
            {drafting
              ? "Claude is drafting questions…"
              : `Showing ${questions.length} of 6 drafted questions`}
          </p>
          <ClaudeTag />
        </div>

        {drafting ? (
          <DraftingRows />
        ) : (
          <ul className="mt-1 divide-y divide-hairline">
            {questions.map((q, i) => {
              const key = `${goalIdx}-${i}`;
              const on = added[key] ?? i === 0;
              return (
                <li
                  key={key}
                  className="flex items-start gap-4 py-3.5 motion-safe:animate-[demo-step-in_0.35s_ease-out_both]"
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <div className="min-w-0 flex-1">
                    <Tag>{q.type}</Tag>
                    <p className="mt-1.5 text-[15px] leading-snug text-ink">{q.label}</p>
                    {q.options && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {q.options.map((o) => (
                          <span
                            key={o}
                            className="rounded-sm border border-hairline px-1.5 py-0.5 text-xs text-ink/60"
                          >
                            {o}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setAdded((a) => ({ ...a, [key]: !on }))}
                    className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors ${
                      on
                        ? "border-transparent bg-ink text-paper"
                        : "border-hairline bg-white text-ink hover:border-ink/30"
                    }`}
                  >
                    {on ? (
                      <>
                        <Check className="size-3.5" /> Added
                      </>
                    ) : (
                      "Add"
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Sheet>
  );
}

const LOGIC_ROWS: Array<{ answer: string; to: string; jump?: boolean }> = [
  { answer: "A friend or colleague", to: "Next question" },
  { answer: "Search", to: "Next question" },
  { answer: "Just browsing", to: "Q6 · Anything else?", jump: true },
];

function LogicVignette() {
  return (
    <Sheet bar={<span>Q2 · Jump rules</span>}>
      <div className="p-5 sm:p-6">
        <p className="font-display text-2xl leading-tight text-ink">How did you find us?</p>
        <div className="mt-5 overflow-hidden rounded-md border border-hairline">
          <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-hairline bg-surface px-4 py-2 font-mono text-[10px] uppercase tracking-wide text-ink/45">
            <span>If they answer</span>
            <span>Go to</span>
          </div>
          {LOGIC_ROWS.map((r) => (
            <div
              key={r.answer}
              className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-hairline px-4 py-3 text-[14px] last:border-b-0"
            >
              <span className="text-ink">{r.answer}</span>
              <span
                className={`inline-flex items-center gap-1.5 ${r.jump ? "font-medium text-brand" : "text-ink/45"}`}
              >
                <ArrowRight className="size-3.5" />
                {r.to}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 font-mono text-[11px] text-ink/45">
          Forward-only, and required questions on skipped paths never block a submit
        </p>
      </div>
    </Sheet>
  );
}

const SUMMARY_THEMES: Array<{ name: string; detail: string; share: number }> = [
  {
    name: "Annual billing feels like a big jump",
    detail: "Teams want a monthly plan before committing for a year.",
    share: 46,
  },
  {
    name: "Missing Slack and HubSpot integrations",
    detail: "Mostly sales and support teams who live in those tools.",
    share: 31,
  },
  {
    name: "Setup took longer than expected",
    detail: "Usually people building their first branching form.",
    share: 18,
  },
];

/** Results view where the Claude summary is the headline, the funnel a footnote. */
function InsightVignette() {
  const [reading, setReading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const rerun = () => {
    setReading(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setReading(false), 1200);
  };

  return (
    <Sheet
      bar={
        <>
          <span className="truncate">Results · Trial feedback</span>
          <span className="shrink-0">Illustrative data</span>
        </>
      }
    >
      <div className="grid grid-cols-3 divide-x divide-hairline border-b border-hairline">
        {[
          ["Responses", "688"],
          ["Completion", "55%"],
          ["Avg. time", "1m 42s"],
        ].map(([k, v]) => (
          <div key={k} className="px-4 py-3.5 sm:px-5">
            <p className="font-mono text-[10px] uppercase tracking-wide text-ink/45">{k}</p>
            <p className="mt-1 font-mono text-lg font-medium tracking-tight whitespace-nowrap tabular-nums text-ink sm:text-xl">
              {v}
            </p>
          </div>
        ))}
      </div>

      <div className="px-5 py-5 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-ink">Summary of 214 open answers</p>
            <ClaudeTag />
          </div>
          <button
            type="button"
            onClick={rerun}
            disabled={reading}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-white px-2.5 text-xs font-medium text-ink transition-colors hover:border-ink/35 disabled:opacity-60"
          >
            <RotateCcw className="size-3" /> {reading ? "Reading…" : "Re-run"}
          </button>
        </div>

        {reading ? (
          <DraftingRows rows={3} />
        ) : (
          <div className="motion-safe:animate-[demo-step-in_0.35s_ease-out_both]">
            <div className="mt-3 flex items-start gap-2.5">
              <span className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-hairline px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-amber-800">
                <span className="size-1.5 rounded-full bg-amber-500" />
                Mixed
              </span>
              <p className="text-[15px] leading-relaxed text-ink">
                People like the product but stall at pricing. Most want a monthly plan before
                committing to annual.
              </p>
            </div>
            <ol className="mt-4 space-y-3">
              {SUMMARY_THEMES.map((t) => (
                <li key={t.name}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium text-ink">{t.name}</p>
                    <span className="font-mono text-xs tabular-nums text-ink/55">{t.share}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-sm bg-surface">
                    <div className="h-1.5 rounded-sm bg-brand" style={{ width: `${t.share}%` }} />
                  </div>
                  <p className="mt-1 text-[13px] text-ink/55">{t.detail}</p>
                </li>
              ))}
            </ol>
            <blockquote className="mt-4 border-l-2 border-ink/15 pl-3 font-display text-lg italic leading-snug text-ink/70">
              “Would happily pay monthly. Annual feels like a big jump for a tool we’re still
              trying.”
            </blockquote>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-hairline bg-paper px-5 py-3 font-mono text-[11px] text-ink/55 sm:px-6">
        <span>Funnel</span>
        <span className="text-ink/30">·</span>
        <span>Opened 1,240</span>
        <ArrowRight className="size-3 text-ink/30" />
        <span>Started 912</span>
        <ArrowRight className="size-3 text-ink/30" />
        <span className="text-brand">Completed 688</span>
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------------ */
/* Content                                                                  */
/* ------------------------------------------------------------------------ */

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
    note: "AI drafting by Claude",
    label: "Build",
    title: (
      <>
        Start from a goal, <em>not</em> a blank page.
      </>
    ),
    body: "Tell Claude what you want to learn. It drafts five to eight questions, each with the right type and answer options. Keep the ones you like, edit the rest, reorder by drag and drop.",
    points: [
      "Claude picks the question type and writes the options",
      "Redraft as often as you like, or start from a template",
      "Live preview of exactly what respondents see",
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
    body: "Jump rules send each respondent down the path that fits their answers, so nobody is asked a question that doesn’t concern them.",
    points: [
      "Answer-based jumps on any choice question",
      "Path-aware validation for required questions",
      "Conversational or classic one-page layout",
    ],
    visual: <LogicVignette />,
  },
  {
    hue: "mint",
    glyph: "learn",
    note: "AI summaries by Claude",
    label: "Learn",
    title: (
      <>
        See where people stop, <em>and why.</em>
      </>
    ),
    body: "Claude reads every open answer for you and comes back with the main themes, how often each came up, the overall sentiment and quotes that prove it. Alongside: a real funnel and drop-off per question.",
    points: [
      "Themes, sentiment and quotes from open answers",
      "Completion rate, time to fill and 7, 30 and 90-day trends",
      "CSV export whenever you need the raw data",
    ],
    visual: <InsightVignette />,
  },
];

/** Icon tints for the dark Features grid (light enough to read on ink). */
const FEATURE_TONES = [
  "text-[oklch(0.78_0.12_255)]",
  "text-[oklch(0.78_0.13_40)]",
  "text-[oklch(0.8_0.1_165)]",
  "text-[oklch(0.86_0.12_88)]",
];

const CAPABILITIES: Array<{ icon: LucideIcon; title: string; body: string; ai?: boolean }> = [
  {
    icon: Lightbulb,
    title: "Questions drafted for you",
    body: "Describe your goal and Claude writes five to eight questions, each with the right type and answer options.",
    ai: true,
  },
  {
    icon: Quote,
    title: "Answers read for you",
    body: "Hundreds of open answers become a few themes, an overall sentiment and quotes to back them up.",
    ai: true,
  },
  {
    icon: ListChecks,
    title: "Seven question types",
    body: "Short and long answers, multiple choice, dropdowns, yes or no, NPS and star ratings.",
  },
  {
    icon: Rows3,
    title: "Two ways to ask",
    body: "One question at a time, like a conversation, or every question on a single page.",
  },
  {
    icon: QrCode,
    title: "Share it anywhere",
    body: "Send a link, print a QR code, embed the form on your site or use your phone’s share sheet.",
  },
  {
    icon: History,
    title: "Finish later",
    body: "Answers are saved as people go, so anyone interrupted can come back and pick up where they left off.",
  },
  {
    icon: Power,
    title: "Open and close on your terms",
    body: "Close a form to stop new responses, reopen it any time. Nothing you’ve collected is lost.",
  },
  {
    icon: Download,
    title: "Take your data with you",
    body: "Export every response to CSV whenever you need it in a spreadsheet.",
  },
];

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "Is Flowform free?",
    a: "Yes. Flowform is free while it’s in early access, with every feature included and no credit card required.",
  },
  {
    q: "Do respondents need an account?",
    a: "No. You share a link (or a QR code, or an embed) and it opens straight in the browser on any device.",
  },
  {
    q: "How do the AI features work?",
    a: "Describe what you want to learn and Claude drafts questions you can accept or edit. On the results side, Claude reads your open-text answers and pulls out themes, sentiment and representative quotes. Summaries are labelled as AI-generated.",
  },
  {
    q: "How is this different from a classic survey?",
    a: "A classic survey shows a wall of questions at once. Flowform shows one question at a time, skips what doesn’t apply, and tells you exactly where people drop off so you can fix it.",
  },
  {
    q: "Where is my data stored?",
    a: "In a managed Postgres database on Supabase, protected by row-level security so only you can read your forms and responses. It isn’t sold or shared.",
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
        {/* Hero */}
        <section className="px-4 pt-14 pb-20 sm:px-6 md:px-8 md:pt-20 lg:pb-28">
          <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-white py-1 pr-3 pl-1.5 text-sm text-ink/70">
                <span className="rounded-full bg-mint-tint px-2 py-0.5 text-xs font-medium text-mint">
                  Updated
                </span>
                AI features now run on Claude Sonnet 5.5
              </span>
              <h1 className="mt-6 font-display text-[3.4rem] leading-[0.95] tracking-[-0.02em] text-ink sm:text-7xl lg:text-[5.6rem]">
                Forms people actually <em className="text-brand">finish.</em>
              </h1>
              <p className="mt-7 max-w-lg text-lg leading-relaxed text-ink/65">
                Flowform turns a survey into a conversation: one question at a time, skipping what
                doesn’t apply, with Claude helping you write the questions and read the answers.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <PrimaryCTA>{session ? "Open dashboard" : "Start building, free"}</PrimaryCTA>
                <Link
                  to="/demo"
                  className="inline-flex h-12 items-center gap-2 rounded-md border border-ink/15 bg-white px-5 text-[15px] font-medium text-ink transition-colors hover:border-ink/35"
                >
                  Try the live demo
                </Link>
              </div>
              <dl className="mt-10 grid max-w-lg grid-cols-3 divide-x divide-hairline border-t border-hairline pt-5">
                <div className="pr-4">
                  <dt className="text-sm font-medium text-ink">Free</dt>
                  <dd className="mt-0.5 text-[13px] leading-snug text-ink/55">
                    while in early access
                  </dd>
                </div>
                <div className="px-4">
                  <dt className="text-sm font-medium text-ink">No sign-up</dt>
                  <dd className="mt-0.5 text-[13px] leading-snug text-ink/55">for respondents</dd>
                </div>
                <div className="pl-4">
                  <dt className="text-sm font-medium text-ink">Open source</dt>
                  <dd className="mt-0.5 text-[13px] leading-snug">
                    <a
                      href={REPO_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ink/55 underline decoration-ink/20 underline-offset-4 transition-colors hover:text-ink hover:decoration-ink/50"
                    >
                      MIT, on GitHub
                    </a>
                  </dd>
                </div>
              </dl>
            </div>
            <HeroForm />
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
                  <h2 className="mt-5 font-display text-[2.6rem] leading-[1.02] text-balance text-ink md:text-[3.4rem]">
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
                <h2 className="font-display text-[2.6rem] leading-[1.02] text-balance md:text-[3.4rem]">
                  Everything a form needs. <em>Nothing it doesn’t.</em>
                </h2>
                <p className="mt-6 max-w-sm text-[17px] leading-relaxed text-paper/60">
                  Claude writes the first draft and reads the answers. Everything in between, from
                  sharing to closing a form, takes a click.
                </p>
                <div className="mt-8">
                  <Link
                    to="/demo"
                    className="inline-flex h-11 items-center gap-2 rounded-md bg-paper px-4 text-sm font-medium text-ink transition-colors hover:bg-white"
                  >
                    Try the live demo
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              </div>
              <ul className="grid border-t border-paper/15 sm:grid-cols-2">
                {CAPABILITIES.map(({ icon: Icon, title, body, ai }, i) => (
                  <li
                    key={title}
                    className={`border-b border-paper/15 py-6 sm:py-7 ${i % 2 === 0 ? "sm:pr-8" : "sm:border-l sm:pl-8"}`}
                  >
                    <h3 className="flex items-center gap-2.5 text-[15px] font-medium tracking-normal text-paper">
                      <Icon
                        className={`size-4 shrink-0 ${FEATURE_TONES[i % FEATURE_TONES.length]}`}
                        strokeWidth={2}
                      />
                      {title}
                      {ai && (
                        <span className="rounded-sm border border-[oklch(0.78_0.12_255)]/40 px-1.5 py-px font-mono text-[10px] font-medium uppercase tracking-wide text-[oklch(0.78_0.12_255)]">
                          Claude
                        </span>
                      )}
                    </h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-paper/65">{body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="px-4 py-20 sm:px-6 md:px-8 md:py-28">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
            <div>
              <h2 className="font-display text-[2.6rem] leading-[1.02] text-balance md:text-[3.4rem]">
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
            {/* Two oversized "answer bars" from the logo mark, as quiet texture */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-4 -right-20 hidden w-[26rem] space-y-6 opacity-[0.14] md:block"
            >
              <div className="h-16 rounded-xl bg-paper" />
              <div className="h-16 w-3/5 rounded-xl bg-paper" />
            </div>
            <div className="relative flex flex-col items-start justify-between gap-10 lg:flex-row lg:items-end">
              <div>
                <h2 className="font-display text-[3rem] leading-[0.98] text-balance md:text-[4.6rem]">
                  Ask one good question
                  <br />
                  <em>at a time.</em>
                </h2>
                <p className="mt-6 max-w-md text-[17px] text-paper/75">
                  Free while in early access. Every feature, every question type, no credit card.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <PrimaryCTA tone="paper">
                  {session ? "Open dashboard" : "Create your first form"}
                </PrimaryCTA>
                <Link
                  to="/demo"
                  className="inline-flex h-12 items-center gap-2 px-3 text-[15px] font-medium text-paper/80 transition-colors hover:text-paper"
                >
                  Or try the demo
                  <ArrowRight className="size-4" />
                </Link>
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
              Built by{" "}
              <a
                href="https://github.com/andriuskleinas"
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink/75 underline decoration-ink/20 underline-offset-4 transition-colors hover:text-ink hover:decoration-ink/50"
              >
                Andrius Kleinas
              </a>
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
