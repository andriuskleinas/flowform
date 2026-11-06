import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, Check, CornerDownLeft, Github } from "lucide-react";
import { useState } from "react";

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
const DEMO_VIDEO_URL = "https://www.loom.com/share/a067acd4829d4d5ba661f69df3316b3b";

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

function SectionLabel({ index, children }: { index: string; children: React.ReactNode }) {
  return (
    <p className="eyebrow flex items-center gap-3">
      <span className="text-brand">{index}</span>
      <span className="h-px w-8 bg-ink/20" />
      {children}
    </p>
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

const HERO_OPTIONS = ["Pricing", "Setup time", "Missing integrations", "Nothing, really"];

function RespondentVignette() {
  const [picked, setPicked] = useState(0);
  const jumps = picked === 0;

  return (
    <figure className="relative">
      <Sheet
        bar={
          <>
            <span className="truncate">flowformapp.vercel.app/f/trial-feedback</span>
            <span className="shrink-0">3 / 5</span>
          </>
        }
      >
        <div className="h-px bg-hairline">
          <div className="h-px w-3/5 bg-brand" />
        </div>
        <div className="px-6 pt-8 pb-7 sm:px-9 sm:pt-10">
          <p className="eyebrow">
            <span className="text-brand">03</span>
            <span className="mx-1.5 text-ink/25">/</span>05
          </p>
          <h3 className="mt-3 font-display text-[2rem] leading-[1.08] text-ink sm:text-[2.4rem]">
            What almost stopped you from signing up?
          </h3>
          <ul className="mt-7 grid gap-2" role="radiogroup" aria-label="Example answer options">
            {HERO_OPTIONS.map((opt, i) => {
              const active = i === picked;
              return (
                <li key={opt}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setPicked(i)}
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
          <div className="mt-7 flex items-center gap-4">
            <span className="inline-flex h-10 items-center rounded-md bg-brand px-5 text-sm font-medium text-white">
              OK
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink/45">
              press Enter <CornerDownLeft className="size-3" />
            </span>
          </div>
        </div>
      </Sheet>

      {/* Margin note: the logic rule this answer triggers */}
      <figcaption
        className={`mt-4 flex items-start gap-3 rounded-lg border border-dashed px-4 py-3 text-sm transition-colors lg:absolute lg:right-[-2.5rem] lg:bottom-6 lg:mt-0 lg:w-60 lg:bg-paper lg:shadow-[0_12px_30px_-18px_rgb(20_22_30/0.35)] ${
          jumps ? "border-brand/40 text-ink" : "border-ink/20 text-ink/55"
        }`}
      >
        <span className="mt-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-brand">
          Logic
        </span>
        <span className="leading-snug">
          {jumps ? (
            <>
              “Pricing” skips ahead to <span className="font-medium">Q5: Plan fit</span>
            </>
          ) : (
            <>Other answers continue to Q4</>
          )}
        </span>
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------------ */
/* Feature vignettes                                                        */
/* ------------------------------------------------------------------------ */

const SUGGESTIONS: Array<{ type: string; text: string }> = [
  { type: "Multiple choice", text: "What were you hoping Flowform would do for you?" },
  { type: "NPS", text: "How likely are you to recommend us to a colleague?" },
  { type: "Long answer", text: "What would make upgrading an easy decision?" },
];

function BuilderVignette() {
  const [added, setAdded] = useState<Record<number, boolean>>({ 0: true });
  return (
    <Sheet bar={<span>Editor · Trial feedback</span>}>
      <div className="p-5 sm:p-6">
        <label className="eyebrow" htmlFor="vignette-goal">
          What do you want to learn?
        </label>
        <div
          id="vignette-goal"
          className="mt-2 rounded-md border border-input bg-surface px-3 py-2.5 text-[15px] text-ink"
        >
          Why trial users don’t upgrade
        </div>
        <ul className="mt-5 divide-y divide-hairline border-y border-hairline">
          {SUGGESTIONS.map((s, i) => (
            <li key={s.text} className="flex items-center gap-4 py-3.5">
              <div className="min-w-0 flex-1">
                <Tag>{s.type}</Tag>
                <p className="mt-1.5 text-[15px] leading-snug text-ink">{s.text}</p>
              </div>
              <button
                type="button"
                onClick={() => setAdded((a) => ({ ...a, [i]: !a[i] }))}
                className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors ${
                  added[i]
                    ? "border-transparent bg-ink text-paper"
                    : "border-hairline bg-white text-ink hover:border-ink/30"
                }`}
              >
                {added[i] ? (
                  <>
                    <Check className="size-3.5" /> Added
                  </>
                ) : (
                  "Add"
                )}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-4 font-mono text-[11px] text-ink/45">Drafted by Claude · edit anything</p>
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

const FUNNEL = [
  { label: "Opened", value: 1240 },
  { label: "Started", value: 912 },
  { label: "Completed", value: 688 },
];

function InsightVignette() {
  const max = FUNNEL[0].value;
  return (
    <Sheet
      bar={
        <>
          <span>Responses · last 30 days</span>
          <span>Illustrative data</span>
        </>
      }
    >
      <div className="grid grid-cols-3 divide-x divide-hairline border-b border-hairline">
        {[
          ["Responses", "688"],
          ["Completion", "55%"],
          ["Avg. time", "1m 42s"],
        ].map(([k, v]) => (
          <div key={k} className="px-4 py-4 sm:px-5">
            <p className="font-mono text-[10px] uppercase tracking-wide text-ink/45">{k}</p>
            <p className="mt-1 font-mono text-xl font-medium tracking-tight tabular-nums text-ink sm:text-2xl">
              {v}
            </p>
          </div>
        ))}
      </div>
      <div className="space-y-2.5 px-5 py-5 sm:px-6">
        {FUNNEL.map((f, i) => (
          <div key={f.label} className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-3">
            <span className="text-[13px] text-ink/60">{f.label}</span>
            <div className="h-2 rounded-sm bg-surface">
              <div
                className={`h-2 rounded-sm ${i === FUNNEL.length - 1 ? "bg-brand" : "bg-ink/70"}`}
                style={{ width: `${(f.value / max) * 100}%` }}
              />
            </div>
            <span className="text-right font-mono text-[12px] tabular-nums text-ink/60">
              {f.value.toLocaleString("en-US")}
            </span>
          </div>
        ))}
      </div>
      <div className="border-t border-hairline bg-paper px-5 py-5 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink/45">
            Summary of 214 open answers
          </p>
          <Tag tone="brand">Claude</Tag>
        </div>
        <p className="mt-2.5 text-[15px] leading-relaxed text-ink">
          Most people stall at the pricing question. Teams want a monthly plan before committing to
          annual.
        </p>
        <blockquote className="mt-3 border-l-2 border-ink/15 pl-3 font-display text-lg italic leading-snug text-ink/70">
          “Would happily pay monthly — annual feels like a big jump for a tool we’re still trying.”
        </blockquote>
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------------ */
/* Content                                                                  */
/* ------------------------------------------------------------------------ */

const FEATURES: Array<{
  index: string;
  label: string;
  title: React.ReactNode;
  body: string;
  points: string[];
  visual: React.ReactNode;
}> = [
  {
    index: "01",
    label: "Build",
    title: (
      <>
        Start from a goal, <em>not</em> a blank page.
      </>
    ),
    body: "Say what you want to learn and Claude drafts well-worded, correctly typed questions. Keep the ones you like, rewrite the rest, and reorder by drag and drop.",
    points: [
      "Seven question types, from short text to NPS",
      "Templates, or start from scratch",
      "Live preview of exactly what respondents see",
    ],
    visual: <BuilderVignette />,
  },
  {
    index: "02",
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
    index: "03",
    label: "Learn",
    title: (
      <>
        See where people stop, <em>and why.</em>
      </>
    ),
    body: "A real funnel from opened to completed, drop-off per question, and a Claude summary that turns hundreds of open answers into a few themes, with quotes to back them up.",
    points: [
      "Completion rate and time to fill",
      "7, 30 and 90-day response trends",
      "CSV export whenever you need the raw data",
    ],
    visual: <InsightVignette />,
  },
];

const BUILT: Array<{ k: string; v: string }> = [
  {
    k: "Rendering",
    v: "TanStack Start with server-side rendering, deployed on Vercel.",
  },
  {
    k: "Data & security",
    v: "Postgres on Supabase. Every table is guarded by row-level security policies.",
  },
  {
    k: "AI",
    v: "Claude drafts questions and summarises open answers, called server-side only.",
  },
  {
    k: "Analytics",
    v: "An event stream of opens, starts and submits powers the funnel and drop-off views.",
  },
  {
    k: "Respondent UX",
    v: "Keyboard-first (Enter, A–D, 0–9), drafts saved locally, reduced-motion aware.",
  },
  {
    k: "Accounts",
    v: "Email sign-up with confirmation, password reset and idle sign-out.",
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
  { href: "#product", label: "Product" },
  { href: "#built", label: "Under the hood" },
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
              <p className="eyebrow">Form builder · One question at a time</p>
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
              <p className="mt-8 font-mono text-[11px] text-ink/45">
                No card · No respondent accounts · Open source
              </p>
            </div>
            <RespondentVignette />
          </div>
        </section>

        {/* Features */}
        <section id="product" className="border-t border-hairline">
          {FEATURES.map((f, i) => (
            <div
              key={f.index}
              className={`px-4 py-20 sm:px-6 md:px-8 md:py-28 ${i > 0 ? "border-t border-hairline" : ""}`}
            >
              <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-20">
                <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                  <SectionLabel index={f.index}>{f.label}</SectionLabel>
                  <h2 className="mt-6 font-display text-[2.6rem] leading-[1.02] text-balance text-ink md:text-[3.4rem]">
                    {f.title}
                  </h2>
                  <p className="mt-6 max-w-md text-[17px] leading-relaxed text-ink/65">{f.body}</p>
                  <ul className="mt-8 max-w-md divide-y divide-hairline border-y border-hairline">
                    {f.points.map((p) => (
                      <li key={p} className="flex items-center gap-3 py-3 text-[15px] text-ink/80">
                        <span className="size-1 rounded-full bg-brand" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={i % 2 === 1 ? "lg:order-1" : ""}>{f.visual}</div>
              </div>
            </div>
          ))}
        </section>

        {/* Under the hood */}
        <section id="built" className="bg-ink px-4 py-20 text-paper sm:px-6 md:px-8 md:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
              <div>
                <p className="eyebrow flex items-center gap-3 text-paper/50">
                  <span className="text-[oklch(0.7_0.16_264)]">04</span>
                  <span className="h-px w-8 bg-paper/25" />
                  Under the hood
                </p>
                <h2 className="mt-6 font-display text-[2.6rem] leading-[1.02] text-balance md:text-[3.4rem]">
                  Built like a product, <em>not a prototype.</em>
                </h2>
                <p className="mt-6 max-w-sm text-[17px] leading-relaxed text-paper/60">
                  Flowform is a portfolio project, designed, built and deployed end to end. This is
                  what runs behind the form.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <a
                    href={REPO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center gap-2 rounded-md bg-paper px-4 text-sm font-medium text-ink transition-colors hover:bg-white"
                  >
                    <Github className="size-4" />
                    Read the source
                  </a>
                  <a
                    href={DEMO_VIDEO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center gap-2 rounded-md border border-paper/20 px-4 text-sm font-medium text-paper transition-colors hover:border-paper/45"
                  >
                    Watch the 60-second demo
                    <ArrowUpRight className="size-4" />
                  </a>
                </div>
              </div>
              <dl className="grid border-t border-paper/15 sm:grid-cols-2">
                {BUILT.map((b, i) => (
                  <div
                    key={b.k}
                    className={`border-b border-paper/15 py-6 sm:py-7 ${i % 2 === 0 ? "sm:pr-8" : "sm:border-l sm:pl-8"}`}
                  >
                    <dt className="font-mono text-[11px] uppercase tracking-wide text-paper/45">
                      {b.k}
                    </dt>
                    <dd className="mt-2.5 text-[15px] leading-relaxed text-paper/85">{b.v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="px-4 py-20 sm:px-6 md:px-8 md:py-28">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
            <div>
              <SectionLabel index="05">FAQ</SectionLabel>
              <h2 className="mt-6 font-display text-[2.6rem] leading-[1.02] text-balance md:text-[3.4rem]">
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
        <section className="border-t border-hairline px-4 py-20 sm:px-6 md:px-8 md:py-28">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-10 lg:flex-row lg:items-end">
            <div>
              <h2 className="font-display text-[3rem] leading-[0.98] md:text-[4.6rem]">
                Ask one good question
                <br />
                <em className="text-brand">at a time.</em>
              </h2>
              <p className="mt-6 max-w-md text-[17px] text-ink/65">
                Free while in early access. Every feature, every question type, no credit card.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <PrimaryCTA>{session ? "Open dashboard" : "Create your first form"}</PrimaryCTA>
              <Link
                to="/demo"
                className="inline-flex h-12 items-center gap-2 px-3 text-[15px] font-medium text-ink/70 transition-colors hover:text-ink"
              >
                Or try the demo
                <ArrowRight className="size-4" />
              </Link>
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
