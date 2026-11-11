import { Link } from "@tanstack/react-router";
import { useId, useState } from "react";
import { ArrowLeft, Eye, EyeOff, GitBranch, MessagesSquare, Sparkles } from "lucide-react";

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

/** A static "question 3 of 5" card, styled like the real respondent view. */
function PreviewCard() {
  return (
    <div className="mt-10 rounded-xl bg-paper p-6 text-ink shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]">
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wide text-ink/45">
        <span>Question 3 of 5</span>
        <span>60%</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink/10">
        <div className="h-full w-3/5 rounded-full bg-brand" />
      </div>
      <p className="mt-6 font-display text-xl leading-snug">
        How likely are you to recommend us to a friend?
      </p>
      <div className="mt-4 grid grid-cols-11 gap-1">
        {Array.from({ length: 11 }, (_, n) => (
          <span
            key={n}
            className={
              "flex h-8 items-center justify-center rounded text-xs font-medium tabular-nums " +
              (n === 9
                ? "bg-brand text-brand-foreground"
                : "border border-hairline bg-white text-ink/60")
            }
          >
            {n}
          </span>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-3">
        <span className="inline-flex h-9 items-center rounded-md bg-ink px-4 text-sm font-medium text-paper">
          OK
        </span>
        <span className="text-xs text-ink/45">
          press <span className="font-mono">Enter ↵</span>
        </span>
      </div>
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
            "h-11 bg-white pl-9 " +
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
