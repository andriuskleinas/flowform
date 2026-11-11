import { Link } from "@tanstack/react-router";
import { useEffect, useId, useState } from "react";
import { ArrowLeft, Check, Eye, EyeOff, GitBranch, MessagesSquare, Sparkles } from "lucide-react";

import { Logo } from "@/components/logo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PanelCopy = { eyebrow: string; title: React.ReactNode };

const PANEL_COPY: Record<"login" | "signup" | "default", PanelCopy> = {
  login: {
    eyebrow: "Welcome back",
    title: (
      <>
        Your responses are <em className="text-[oklch(0.72_0.15_264)]">waiting.</em>
      </>
    ),
  },
  signup: {
    eyebrow: "Free to start",
    title: (
      <>
        Forms people actually <em className="text-[oklch(0.72_0.15_264)]">finish.</em>
      </>
    ),
  },
  default: {
    eyebrow: "Flowform",
    title: (
      <>
        Forms that feel like a <em className="text-[oklch(0.72_0.15_264)]">conversation.</em>
      </>
    ),
  },
};

const FEATURES = [
  { icon: MessagesSquare, text: "One question at a time, so people keep going" },
  { icon: GitBranch, text: "Logic jumps skip what doesn't apply" },
  { icon: Sparkles, text: "Claude drafts questions and summarises answers" },
];

/**
 * Shared chrome for the signed-out auth pages (login, signup, password reset,
 * confirmation). Form on the left; on wide screens an ink panel on the right
 * with a small product preview so the page doesn't feel empty.
 */
export function AuthShell({
  children,
  panel = "default",
}: {
  children: React.ReactNode;
  panel?: keyof typeof PANEL_COPY;
}) {
  const copy = PANEL_COPY[panel];
  return (
    <div className="min-h-screen bg-surface text-ink lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-6 py-6 md:px-10">
          <Link to="/" className="flex items-center gap-2">
            <Logo />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-ink/55 transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-4" />
            Home
          </Link>
        </header>

        <main className="flex flex-1 items-center justify-center px-6 py-10 md:px-10">
          <div className="w-full max-w-sm">{children}</div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 px-6 py-6 text-xs text-ink/45 md:px-10">
          <span>© {new Date().getFullYear()} Flowform</span>
          <span className="flex gap-4">
            <Link to="/terms" className="hover:text-ink">
              Terms
            </Link>
            <Link to="/privacy" className="hover:text-ink">
              Privacy
            </Link>
          </span>
        </footer>
      </div>

      <aside
        aria-hidden
        className="relative hidden overflow-hidden bg-ink text-paper lg:flex lg:flex-col lg:justify-center lg:px-14 xl:px-20"
      >
        {/* Faint dot grid for texture. */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="relative max-w-md">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-paper/50">
            {copy.eyebrow}
          </p>
          <h2 className="mt-4 font-display text-[2.6rem] leading-[1.04] xl:text-5xl">
            {copy.title}
          </h2>

          <PreviewCard />

          <ul className="mt-10 space-y-3.5">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[15px] text-paper/75">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-paper/[0.08]">
                  <Icon className="size-4 text-paper/80" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

type PreviewQuestion =
  | { kind: "text"; title: string; placeholder: string; sample: string }
  | { kind: "choice"; title: string; options: string[]; sample: string }
  | { kind: "nps"; title: string; sample: string };

const PREVIEW_QUESTIONS: PreviewQuestion[] = [
  {
    kind: "text",
    title: "First, what should we call you?",
    placeholder: "Your name",
    sample: "Maya",
  },
  {
    kind: "choice",
    title: "What are you collecting?",
    options: ["Customer feedback", "Event sign-ups", "Job applications"],
    sample: "Customer feedback",
  },
  { kind: "nps", title: "How likely are you to recommend us to a friend?", sample: "9" },
  {
    kind: "text",
    title: "What would make it a 10?",
    placeholder: "Type your answer…",
    sample: "A Slack ping for every new response.",
  },
  {
    kind: "choice",
    title: "Can we follow up by email?",
    options: ["Yes, please", "No thanks"],
    sample: "Yes, please",
  },
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A self-playing Flowform: it types and clicks its way through five questions,
 * shows the thank-you screen and loops. Visitors can click answers and OK to
 * take over; autoplay resumes after a few idle seconds. Reduced-motion users
 * get a still card they can still click through.
 */
function PreviewCard() {
  const total = PREVIEW_QUESTIONS.length;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [pressed, setPressed] = useState(false);
  // Bumped on every visitor click: pauses autoplay and restarts the idle timer.
  const [touchedAt, setTouchedAt] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  const question = PREVIEW_QUESTIONS[step] as PreviewQuestion | undefined;
  const answer = answers[step] ?? "";

  const setAnswer = (value: string) =>
    setAnswers((prev) => {
      const next = [...prev];
      next[step] = value;
      return next;
    });

  const restart = () => {
    setStep(0);
    setAnswers([]);
  };

  // Autoplay script for the current step.
  useEffect(() => {
    if (reducedMotion) return;
    let cancelled = false;
    void (async () => {
      if (touchedAt) {
        await wait(6000);
        if (cancelled) return;
      }
      if (!question) {
        await wait(2600);
        if (!cancelled) restart();
        return;
      }
      if (!answers[step]) {
        await wait(1100);
        if (question.kind === "text") {
          for (let i = 1; i <= question.sample.length; i++) {
            if (cancelled) return;
            setAnswer(question.sample.slice(0, i));
            await wait(45 + Math.random() * 55);
          }
        } else {
          if (cancelled) return;
          setAnswer(question.sample);
        }
      }
      await wait(950);
      if (cancelled) return;
      setPressed(true);
      await wait(170);
      if (cancelled) return;
      setPressed(false);
      setStep((s) => s + 1);
    })();
    return () => {
      cancelled = true;
      setPressed(false);
    };
    // Re-run per step and per visitor click; answers are read once at start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, touchedAt, reducedMotion]);

  const touch = () => setTouchedAt(Date.now());
  const choose = (value: string) => {
    touch();
    setAnswer(value);
  };
  const submit = () => {
    touch();
    if (!question) return restart();
    if (!answer) setAnswer(question.sample);
    setStep((s) => s + 1);
  };

  const progress = Math.round((Math.min(step, total) / total) * 100);

  return (
    <div className="mt-10">
      <div className="rounded-xl bg-paper p-6 text-ink shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wide text-ink/45">
          <span>{question ? `Question ${step + 1} of ${total}` : "Complete"}</span>
          <span className="tabular-nums">{progress}%</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink/10">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div
          key={step}
          className="min-h-[12.5rem] pt-6 motion-safe:animate-[demo-step-in_0.4s_ease-out_both]"
        >
          {question ? (
            <>
              <p className="font-display text-xl leading-snug">{question.title}</p>
              <div className="mt-4">
                {question.kind === "text" && (
                  <div
                    onClick={() => choose(question.sample)}
                    className="flex min-h-10 cursor-text items-center border-b-2 border-brand/70 pb-1.5 text-lg"
                  >
                    {answer ? (
                      <span>{answer}</span>
                    ) : (
                      <span className="text-ink/30">{question.placeholder}</span>
                    )}
                    <span className="ml-0.5 h-5 w-px animate-caret-blink bg-ink duration-1000" />
                  </div>
                )}
                {question.kind === "choice" && (
                  <div className="space-y-1.5">
                    {question.options.map((option, i) => {
                      const selected = answer === option;
                      return (
                        <button
                          key={option}
                          type="button"
                          tabIndex={-1}
                          onClick={() => choose(option)}
                          className={
                            "flex w-full items-center gap-2.5 rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors duration-150 " +
                            (selected
                              ? "border-brand bg-brand/10 text-ink"
                              : "border-hairline bg-card text-ink/70 hover:border-brand/50")
                          }
                        >
                          <span
                            className={
                              "flex size-5 items-center justify-center rounded border font-mono text-[10px] transition-colors duration-150 " +
                              (selected
                                ? "border-brand bg-brand text-brand-foreground"
                                : "border-hairline text-ink/50")
                            }
                          >
                            {String.fromCharCode(65 + i)}
                          </span>
                          {option}
                          {selected && <Check className="ml-auto size-4 text-brand" />}
                        </button>
                      );
                    })}
                  </div>
                )}
                {question.kind === "nps" && (
                  <div className="grid grid-cols-11 gap-1">
                    {Array.from({ length: 11 }, (_, n) => {
                      const selected = answer === String(n);
                      return (
                        <button
                          key={n}
                          type="button"
                          tabIndex={-1}
                          onClick={() => choose(String(n))}
                          className={
                            "flex h-8 items-center justify-center rounded text-xs font-medium tabular-nums transition-all duration-150 " +
                            (selected
                              ? "scale-110 bg-brand text-brand-foreground"
                              : "border border-hairline bg-card text-ink/60 hover:border-brand/50")
                          }
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex min-h-[11rem] flex-col items-center justify-center text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-brand text-brand-foreground motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-500">
                <Check className="size-5" />
              </span>
              <p className="mt-4 font-display text-xl">Thanks, {answers[0] || "friend"}!</p>
              <p className="mt-1 text-sm text-ink/55">That's everything. Your answers are in.</p>
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            tabIndex={-1}
            onClick={submit}
            className={
              "inline-flex h-9 items-center rounded-md bg-ink px-4 text-sm font-medium text-paper transition-transform duration-150 hover:bg-ink/90 " +
              (pressed ? "scale-95" : "")
            }
          >
            {question ? (step === total - 1 ? "Submit" : "OK") : "Start again"}
          </button>
          <span className="text-xs text-ink/45">
            press <span className="font-mono">Enter ↵</span>
          </span>
        </div>
      </div>
      <p className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-paper/40">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full rounded-full bg-[oklch(0.72_0.15_264)] opacity-75 motion-safe:animate-ping" />
          <span className="relative inline-flex size-1.5 rounded-full bg-[oklch(0.72_0.15_264)]" />
        </span>
        Live preview · click to answer
      </p>
    </div>
  );
}

/* ------------------------------ Form pieces ------------------------------ */

/**
 * Labelled input with a leading icon and an inline error. Used instead of the
 * browser's native validation bubble, which renders detached from the field.
 */
export function AuthField({
  label,
  icon: Icon,
  error,
  hint,
  labelAction,
  type = "text",
  ...inputProps
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  error?: string | null;
  hint?: React.ReactNode;
  labelAction?: React.ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {labelAction}
      </div>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink/35" />
        <Input
          id={id}
          type={isPassword && show ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={
            "h-11 bg-card pl-9 " +
            (isPassword ? "pr-10 " : "") +
            (error ? "border-destructive focus-visible:ring-destructive/30" : "")
          }
          {...inputProps}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded text-ink/40 hover:text-ink"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink/50">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
