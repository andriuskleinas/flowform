import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Check,
  GitBranch,
  Github,
  LineChart,
  Palette,
  PenLine,
  Quote,
  Send,
  Sparkles,
  Star,
} from "lucide-react";
import { useEffect, useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { UserMenu } from "@/components/user-menu";
import { getInitialsFromName } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";

export const Route = createFileRoute("/")({
  component: Index,
});

function PrimaryCTA({
  children,
  size = "md",
  variant = "brand",
}: {
  children: React.ReactNode;
  size?: "md" | "lg";
  variant?: "brand" | "light";
}) {
  const { session } = useAuth();
  const to = session ? "/dashboard" : "/signup";
  const sizing = size === "lg" ? "px-8 py-4 text-base" : "px-3 py-2 text-sm sm:px-5 sm:py-2.5";
  const variantClass =
    variant === "brand"
      ? "bg-brand text-brand-foreground hover:shadow-lg hover:shadow-brand/25"
      : "bg-white text-ink hover:scale-[1.02]";
  return (
    <Link
      to={to}
      data-cta="get-started"
      className={`inline-flex items-center gap-2 rounded-full font-semibold whitespace-nowrap transition-all ${sizing} ${variantClass}`}
    >
      {children}
      <ArrowRight className="size-4" />
    </Link>
  );
}

type MockQuestion =
  | { kind: "text"; label: string; placeholder: string }
  | { kind: "choice"; label: string; options: string[] }
  | { kind: "rating"; label: string };

const MOCK_QUESTIONS: MockQuestion[] = [
  { kind: "text", label: "What's your name?", placeholder: "Type your answer…" },
  {
    kind: "choice",
    label: "Which best describes your team?",
    options: ["Design", "Product", "Research", "Marketing"],
  },
  { kind: "rating", label: "How likely are you to recommend us?" },
];

const SHARDS = [
  { top: "8%", left: "6%", size: 56, color: "brand", delay: "0s", duration: "11s" },
  { top: "72%", left: "12%", size: 36, color: "gold", delay: "-3s", duration: "13s" },
  { top: "20%", left: "88%", size: 44, color: "gold", delay: "-6s", duration: "15s" },
  { top: "78%", left: "82%", size: 64, color: "brand", delay: "-2s", duration: "12s" },
  { top: "50%", left: "94%", size: 28, color: "brand", delay: "-9s", duration: "17s" },
];

function AnimatedFormMock() {
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState("");

  // Auto-advance the question every 3.6s
  useEffect(() => {
    const id = setInterval(() => {
      setStep((s) => (s + 1) % MOCK_QUESTIONS.length);
    }, 3600);
    return () => clearInterval(id);
  }, []);

  // Typewriter effect for the active question label
  useEffect(() => {
    setTyped("");
    const label = MOCK_QUESTIONS[step].label;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(label.slice(0, i));
      if (i >= label.length) clearInterval(id);
    }, 28);
    return () => clearInterval(id);
  }, [step]);

  const q = MOCK_QUESTIONS[step];
  const progress = ((step + 1) / MOCK_QUESTIONS.length) * 100;

  return (
    <div
      className="relative aspect-[3/2] w-full overflow-hidden bg-gradient-to-br from-white via-surface to-white"
      aria-label="Animated Flowform preview cycling through example questions"
    >
      {/* Floating ambient shards */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {SHARDS.map((s, i) => (
          <div
            key={i}
            className={`absolute rounded-2xl opacity-40 blur-[2px] motion-safe:animate-[shard-drift_var(--dur)_ease-in-out_infinite] ${
              s.color === "brand" ? "bg-brand/30" : "bg-gold/40"
            }`}
            style={{
              top: s.top,
              left: s.left,
              width: s.size,
              height: s.size * 0.6,
              animationDelay: s.delay,
              ["--dur" as string]: s.duration,
              transform:
                "translate3d(calc(var(--px, 0) * 0.04px), calc(var(--py, 0) * 0.04px), 0) rotate(-12deg)",
            }}
          />
        ))}
      </div>

      {/* Form card */}
      <div className="absolute inset-0 flex items-center justify-center p-[6%]">
        <div className="relative w-full max-w-[78%] rounded-2xl border border-ink/5 bg-white/90 p-6 shadow-xl backdrop-blur-sm md:p-8">
          {/* Progress */}
          <div className="mb-6 flex items-center gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink/40">
              {step + 1} / {MOCK_QUESTIONS.length}
            </span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-ink/5">
              <div
                className="h-full rounded-full bg-brand transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Question label with typewriter caret */}
          <h3 className="min-h-[2.5em] text-xl font-bold tracking-tight text-ink md:text-2xl">
            {typed}
            <span
              aria-hidden
              className="ml-0.5 inline-block h-[1em] w-[2px] -translate-y-[2px] bg-brand align-middle motion-safe:animate-[caret-blink_1s_steps(2)_infinite]"
            />
          </h3>

          {/* Answer area swaps per question */}
          <div key={step} className="mt-5 motion-safe:animate-[fade-in_0.5s_ease-out_both]">
            {q.kind === "text" && (
              <div className="rounded-lg border border-ink/10 bg-surface px-4 py-3 text-sm text-ink/40">
                {q.placeholder}
              </div>
            )}
            {q.kind === "choice" && (
              <ul className="grid grid-cols-2 gap-2">
                {q.options.map((opt, i) => (
                  <li
                    key={opt}
                    className="flex items-center gap-2 rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm font-medium text-ink/70"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <span className="grid size-5 place-items-center rounded border border-ink/15 text-[10px] font-bold text-ink/40">
                      {String.fromCharCode(65 + i)}
                    </span>
                    {opt}
                  </li>
                ))}
              </ul>
            )}
            {q.kind === "rating" && (
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <span
                    key={n}
                    className={`grid h-9 flex-1 place-items-center rounded-md border text-sm font-semibold transition-colors ${
                      n <= 8
                        ? "border-brand/30 bg-brand/10 text-brand"
                        : "border-ink/10 bg-white text-ink/50"
                    }`}
                  >
                    {n}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Continue button */}
          <div className="mt-6 flex items-center justify-between">
            <span className="text-xs text-ink/40">Press Enter ↵</span>
            <button
              type="button"
              tabIndex={-1}
              aria-hidden
              className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground shadow-md shadow-brand/20 motion-safe:animate-[btn-breathe_2.6s_ease-in-out_infinite]"
            >
              Continue
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroPreview() {
  return (
    <div
      className="group relative mt-16 motion-safe:animate-[hero-rise_0.7s_ease-out_both] md:mt-20"
      style={{ perspective: "1200px" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-10 overflow-hidden rounded-[48px] transition-opacity duration-500"
        style={{ opacity: "calc(0.75 + 0.35 * var(--active, 0))" }}
      >
        <div
          className="absolute left-1/2 top-1/2 size-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/40 blur-3xl will-change-transform motion-safe:animate-[aurora-drift-a_14s_ease-in-out_infinite]"
          style={{ mixBlendMode: "screen" }}
        />
        <div
          className="absolute left-1/2 top-1/2 size-[55%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/40 blur-3xl will-change-transform motion-safe:animate-[aurora-drift-b_18s_ease-in-out_infinite]"
          style={{ mixBlendMode: "screen" }}
        />
        <div className="absolute inset-6 rounded-[40px] border border-brand/20 motion-safe:animate-[aurora-pulse_6s_ease-in-out_infinite]" />
      </div>
      <div
        className="relative overflow-hidden rounded-2xl border border-ink/5 bg-white shadow-2xl transition-transform duration-300 ease-out motion-safe:animate-[float_6s_ease-in-out_infinite] will-change-transform"
        style={{
          transform:
            "perspective(1200px) rotateX(calc((0.5 - var(--sy, 0.5)) * 8deg)) rotateY(calc((var(--sx, 0.5) - 0.5) * 10deg))",
          transformStyle: "preserve-3d",
        }}
      >
        <AnimatedFormMock />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            background:
              "radial-gradient(circle 280px at calc(var(--sx, 0.5) * 100%) calc(var(--sy, 0.5) * 100%), rgba(255,255,255,0.55), transparent 70%)",
            mixBlendMode: "soft-light",
            opacity: "var(--active, 0)",
          }}
        />
      </div>
    </div>
  );
}

const testimonials: Array<{
  quote: string;
  name: string;
  role: string;
  company: string;
}> = [
  {
    quote: "We replaced three survey tools with one Flowform. Response rates doubled in a week.",
    name: "Maya Chen",
    role: "Head of Research",
    company: "Northwind",
  },
  {
    quote: "It finally looks like our brand. Customers actually finish the form.",
    name: "Daniel Ortiz",
    role: "Design Lead",
    company: "Lumen",
  },
  {
    quote: "The drop-off insights are surgical. We rewrote our onboarding in an afternoon.",
    name: "Priya Raman",
    role: "Growth",
    company: "Axiom",
  },
  {
    quote: "Setup took an afternoon. Our reply rate hasn't dropped below 60% since.",
    name: "Jordan Blake",
    role: "Ops Lead",
    company: "Fernbridge",
  },
];

function TestimonialsCarousel() {
  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);
  const [count, setCount] = useState(0);
  const [paused, setPaused] = useState(false);
  const [interacted, setInteracted] = useState(false);

  useEffect(() => {
    if (!api) return;
    setCount(api.scrollSnapList().length);
    setSelected(api.selectedScrollSnap());
    api.on("select", () => setSelected(api.selectedScrollSnap()));
  }, [api]);

  // Autoplay pauses while hovered/focused and stops for good once the
  // user takes over (WCAG 2.2.2 — no unstoppable auto-updating content).
  useEffect(() => {
    if (!api || paused || interacted) return;
    const id = setInterval(() => api.scrollNext(), 6000);
    return () => clearInterval(id);
  }, [api, paused, interacted]);

  return (
    <Carousel
      setApi={setApi}
      opts={{ loop: true, align: "center" }}
      className="mx-auto w-full max-w-6xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onPointerDown={() => setInteracted(true)}
    >
      <CarouselContent className="-ml-6">
        {testimonials.map((t, i) => {
          const isActive = i === selected;
          return (
            <CarouselItem key={t.name} className="pl-6 md:basis-1/2 lg:basis-1/3">
              <article
                className={`group relative flex h-full flex-col overflow-hidden rounded-3xl border bg-white p-10 transition-all duration-300 hover:-translate-y-1 ${
                  isActive
                    ? "border-brand/20 shadow-2xl shadow-brand/10 ring-1 ring-brand/20"
                    : "border-ink/5 shadow-xl shadow-ink/5 hover:shadow-2xl hover:shadow-brand/10"
                }`}
              >
                {/* Watermark quote glyph */}
                <Quote
                  aria-hidden
                  className="pointer-events-none absolute -top-2 -left-2 size-28 rotate-180 text-brand/10 transition-colors duration-300 group-hover:text-brand/15"
                  strokeWidth={1}
                />

                {/* Stars */}
                <div className="relative flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className="size-4 fill-gold text-gold" strokeWidth={0} />
                  ))}
                </div>

                {/* Quote */}
                <p className="relative mt-6 flex-1 text-xl font-medium leading-snug tracking-tight text-ink md:text-2xl">
                  &ldquo;{t.quote}&rdquo;
                </p>

                {/* Footer */}
                <div className="relative mt-10 flex items-center gap-4 border-t border-ink/5 pt-6">
                  <div className="grid size-12 shrink-0 place-items-center rounded-full bg-brand/10 text-sm font-bold text-brand">
                    {getInitialsFromName(t.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-bold text-ink">{t.name}</div>
                    <div className="truncate text-sm text-ink/50">
                      {t.role} · {t.company}
                    </div>
                  </div>
                </div>
              </article>
            </CarouselItem>
          );
        })}
      </CarouselContent>
      <CarouselPrevious className="hidden border-ink/5 bg-white text-ink shadow-md hover:bg-brand hover:text-brand-foreground md:-left-14 md:flex" />
      <CarouselNext className="hidden border-ink/5 bg-white text-ink shadow-md hover:bg-brand hover:text-brand-foreground md:-right-14 md:flex" />

      <div className="mt-10 flex justify-center gap-2">
        {Array.from({ length: count }).map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to testimonial ${i + 1}`}
            onClick={() => api?.scrollTo(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === selected ? "w-8 bg-brand" : "w-2 bg-ink/15 hover:bg-ink/30"
            }`}
          />
        ))}
      </div>
    </Carousel>
  );
}

type FeatureAccent = "brand" | "gold";

const features: Array<{
  icon: typeof GitBranch;
  title: string;
  body: string;
  accent?: FeatureAccent;
}> = [
  {
    icon: Sparkles,
    title: "AI that drafts your questions.",
    body: "Describe what you want to learn and Flowform suggests sharp, well-worded questions — powered by Claude. Accept, edit, or riff.",
    accent: "gold",
  },
  {
    icon: GitBranch,
    title: "Logic that adapts.",
    body: "Branch, skip, and personalize in real time. Every respondent gets a path built just for them — no spreadsheets required.",
  },
  {
    icon: Palette,
    title: "Design that owns the room.",
    body: "Pixel-perfect themes, your typography, your palette. A form that looks like it belongs on your homepage.",
  },
  {
    icon: BarChart3,
    title: "Insight, not just data.",
    body: "Drop-off heatmaps, completion velocity, and live response streams — the signal behind every answer.",
    accent: "gold",
  },
];

const HOW_IT_WORKS: Array<{
  icon: typeof PenLine;
  step: string;
  title: string;
  body: string;
}> = [
  {
    icon: PenLine,
    step: "1",
    title: "Build",
    body: "Start from a blank canvas, add questions in the drag-and-drop editor, or let AI draft them from a one-line goal.",
  },
  {
    icon: Send,
    step: "2",
    title: "Share",
    body: "Publish to a link your audience can open anywhere. No accounts, no downloads — one question at a time.",
  },
  {
    icon: LineChart,
    step: "3",
    title: "Learn",
    body: "Watch responses stream into your dashboard the moment they arrive, and spot where people drop off.",
  },
];

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "Is Flowform really free?",
    a: "Yes. Flowform is free while in early access — every feature included, no credit card required. If that ever changes, you'll hear about it well in advance.",
  },
  {
    q: "Do my respondents need an account?",
    a: "No. You share a link and it opens straight in the browser, on any device. Respondents answer one question at a time and they're done — no sign-up, no app.",
  },
  {
    q: "How do the AI question suggestions work?",
    a: "Describe what you're trying to learn and Flowform — powered by Anthropic's Claude — drafts well-worded questions for you. You stay in control: accept them as-is, edit them, or use them as a starting point.",
  },
  {
    q: "Can I see responses as they come in?",
    a: "Yes. Every response appears in your dashboard in real time, per form, so you can act on feedback the moment it lands instead of waiting for a weekly export.",
  },
  {
    q: "How is this different from a classic survey tool?",
    a: "Classic surveys show a wall of questions and most people bail. Flowform shows one question at a time, like a conversation — which keeps people engaged all the way to the last answer.",
  },
  {
    q: "Where is my data stored?",
    a: "Your forms and responses are stored securely in a managed Postgres database (Supabase), protected with row-level security so only you can access your data. We don't sell or share it.",
  },
];

const featureAccentStyles: Record<
  FeatureAccent,
  {
    border: string;
    iconBg: string;
    iconText: string;
    glow: string;
    shadow: string;
    bar: string;
  }
> = {
  brand: {
    border: "border-brand/10",
    iconBg: "bg-brand/10",
    iconText: "text-brand",
    glow: "bg-brand/20",
    shadow: "hover:shadow-[0_24px_60px_-20px_color-mix(in_oklch,var(--brand)_35%,transparent)]",
    bar: "bg-brand/40",
  },
  gold: {
    border: "border-gold/20",
    iconBg: "bg-gold/10",
    iconText: "text-gold",
    glow: "bg-gold/25",
    shadow: "hover:shadow-[0_24px_60px_-20px_color-mix(in_oklch,var(--gold)_35%,transparent)]",
    bar: "bg-gold/50",
  },
};

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

function SiteHeader() {
  const { session } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-ink/5 bg-surface/85 shadow-[0_4px_20px_rgb(0,0,0,0.04)] backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <nav
        className={`mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 transition-[padding] duration-300 sm:gap-3 sm:px-6 md:px-8 ${
          scrolled ? "py-3.5" : "py-6"
        }`}
      >
        <a href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand">
            <span className="size-3 rounded-sm bg-white" />
          </span>
          <span className="text-xl font-bold tracking-tight">Flowform</span>
        </a>
        <div className="flex shrink-0 items-center gap-2 sm:gap-6 md:gap-8">
          <div className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-ink/60 transition-colors hover:text-ink"
              >
                {l.label}
              </a>
            ))}
          </div>
          {session ? (
            <>
              <Link
                to="/dashboard"
                className="text-sm font-medium whitespace-nowrap text-ink/60 transition-colors hover:text-ink"
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
                className="text-sm font-medium whitespace-nowrap text-ink/60 transition-colors hover:text-ink"
              >
                Log in
              </Link>
              <PrimaryCTA>Get started</PrimaryCTA>
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
    <div className="min-h-screen bg-surface text-ink">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section
          className="relative overflow-hidden bg-gradient-to-b from-surface via-surface to-white px-6 pt-16 pb-24 md:px-8 md:pt-20 md:pb-32"
          onPointerMove={(e) => {
            const el = e.currentTarget;
            const r = el.getBoundingClientRect();
            const sx = (e.clientX - r.left) / r.width;
            const sy = (e.clientY - r.top) / r.height;
            el.style.setProperty("--sx", `${sx}`);
            el.style.setProperty("--sy", `${sy}`);
            el.style.setProperty("--px", `${(sx - 0.5) * r.width}`);
            el.style.setProperty("--py", `${(sy - 0.5) * r.height}`);
            el.style.setProperty("--active", "1");
          }}
          onPointerLeave={(e) => {
            const el = e.currentTarget;
            el.style.setProperty("--sx", "0.5");
            el.style.setProperty("--sy", "0.5");
            el.style.setProperty("--px", "0");
            el.style.setProperty("--py", "0");
            el.style.setProperty("--active", "0");
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 transition-opacity duration-500"
            style={{
              background:
                "radial-gradient(circle 600px at calc(var(--sx, 0.5) * 100%) calc(var(--sy, 0.5) * 100%), color-mix(in oklch, var(--brand) 18%, transparent), transparent 70%)",
              opacity: "var(--active, 0)",
            }}
          />
          <div className="relative mx-auto max-w-4xl text-center">
            <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight text-balance md:text-7xl">
              Forms people <span className="text-brand">actually finish.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink/60 md:mt-8 md:text-xl">
              Craft beautifully simple, one-question-at-a-time experiences that feel less like a
              survey and more like a conversation worth having.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4 md:mt-12">
              <PrimaryCTA size="lg">Start building</PrimaryCTA>
              {session ? (
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-ink/70 transition-colors hover:text-ink"
                >
                  Go to dashboard
                  <ArrowRight className="size-4" />
                </Link>
              ) : (
                <Link
                  to="/demo"
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-ink/70 transition-colors hover:text-ink"
                >
                  See it in action
                  <ArrowRight className="size-4" />
                </Link>
              )}
            </div>

            {/* Preview */}
            <HeroPreview />
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          className="relative overflow-hidden bg-gradient-to-b from-white via-white to-surface px-6 py-24 md:px-8 md:py-32"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 -left-32 size-[480px] rounded-full bg-brand/5 blur-[120px]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 -right-32 size-[460px] rounded-full bg-gold/5 blur-[120px]"
          />

          <div className="relative mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-extrabold leading-[1.05] tracking-tight text-balance md:text-5xl">
                Built for the questions
                <br />
                <span className="text-brand">that matter.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-base text-ink/60 md:text-lg">
                A precise toolkit for teams who treat every interaction like a first impression.
              </p>
            </div>

            <ul className="mx-auto mt-16 grid max-w-5xl gap-6 md:grid-cols-2 lg:gap-8">
              {features.map(({ icon: Icon, title, body, accent = "brand" }) => {
                const a = featureAccentStyles[accent];
                return (
                  <li
                    key={title}
                    className={`group relative rounded-[28px] border ${a.border} bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.03)] transition-all duration-500 hover:-translate-y-1 ${a.shadow} lg:p-10`}
                  >
                    <div className="relative mb-8">
                      <div
                        aria-hidden
                        className={`pointer-events-none absolute -top-6 -left-6 size-28 rounded-full ${a.glow} opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100`}
                      />
                      <div
                        className={`relative flex size-14 items-center justify-center rounded-2xl ${a.iconBg} ${a.iconText} transition-transform duration-500 group-hover:scale-110`}
                      >
                        <Icon className="size-6" strokeWidth={2} />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold tracking-tight text-ink">{title}</h3>
                    <p className="mt-4 text-base leading-relaxed text-ink/60 md:text-lg">{body}</p>
                    <div
                      aria-hidden
                      className={`mt-8 h-px w-12 ${a.bar} opacity-60 transition-all duration-500 group-hover:w-20 group-hover:opacity-100`}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="relative overflow-hidden bg-surface px-6 py-24 md:px-8 md:py-32"
        >
          <div className="relative mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-extrabold leading-[1.05] tracking-tight text-balance md:text-5xl">
                Live in <span className="text-brand">three steps.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-base text-ink/60 md:text-lg">
                From blank page to answers rolling in — without reading a manual.
              </p>
            </div>

            <ol className="relative mx-auto mt-16 grid max-w-5xl gap-10 md:grid-cols-3 md:gap-8">
              {/* Connecting line (desktop) */}
              <div
                aria-hidden
                className="absolute top-7 right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-brand/10 via-brand/30 to-brand/10 md:block"
              />
              {HOW_IT_WORKS.map(({ icon: Icon, step, title, body }) => (
                <li key={step} className="relative flex flex-col items-center text-center">
                  <div className="relative z-10 grid size-14 place-items-center rounded-2xl border border-brand/15 bg-white text-brand shadow-sm">
                    <Icon className="size-6" strokeWidth={2} />
                  </div>
                  <span className="mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand/70">
                    Step {step}
                  </span>
                  <h3 className="mt-2 text-xl font-bold tracking-tight text-ink">{title}</h3>
                  <p className="mt-3 max-w-xs text-base leading-relaxed text-ink/60">{body}</p>
                </li>
              ))}
            </ol>

            <div className="mt-14 flex justify-center">
              <Link
                to="/demo"
                className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white px-6 py-3 text-sm font-semibold text-ink transition-all hover:border-brand/30 hover:text-brand"
              >
                Try a live example form
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="relative overflow-hidden bg-gradient-to-b from-surface via-white to-surface px-6 py-24 md:px-8 md:py-32">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -left-24 size-[420px] rounded-full bg-brand/15 blur-[120px]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -right-24 size-[420px] rounded-full bg-gold/20 blur-[120px]"
          />
          <div className="relative mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand/70">
                Early access feedback
              </span>
              <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-balance md:text-5xl">
                Loved by teams who ask better questions.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base text-ink/60 md:text-lg">
                What early users say after swapping clunky surveys for conversations their customers
                actually finish.
              </p>
            </div>

            <div className="mt-16">
              <TestimonialsCarousel />
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section
          id="pricing"
          className="relative overflow-hidden bg-gradient-to-b from-surface to-white px-6 py-24 md:px-8 md:py-32"
        >
          <div className="relative mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-extrabold leading-[1.05] tracking-tight text-balance md:text-5xl">
                Pricing that's easy to say <span className="text-brand">yes to.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-base text-ink/60 md:text-lg">
                One plan while we're in early access: everything, for everyone, for free.
              </p>
            </div>

            <div className="mx-auto mt-14 max-w-md">
              <div className="relative rounded-[28px] border border-brand/15 bg-white p-8 shadow-[0_24px_60px_-20px_color-mix(in_oklch,var(--brand)_25%,transparent)] md:p-10">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-brand">
                  <Sparkles className="size-3" />
                  Early access
                </span>
                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-6xl font-extrabold tracking-tight text-ink">$0</span>
                  <span className="text-sm font-medium text-ink/50">/ month</span>
                </div>
                <p className="mt-3 text-sm text-ink/60">
                  Free forever for early users. No credit card required.
                </p>
                <ul className="mt-8 space-y-3">
                  {[
                    "Every feature included",
                    "AI question suggestions",
                    "Real-time response dashboard",
                    "One-question-at-a-time forms",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-ink/80">
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <PrimaryCTA size="lg">Claim your free account</PrimaryCTA>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="relative overflow-hidden bg-white px-6 py-24 md:px-8 md:py-32">
          <div className="relative mx-auto max-w-3xl">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-extrabold leading-[1.05] tracking-tight text-balance md:text-5xl">
                Questions? <span className="text-brand">Answered.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-base text-ink/60 md:text-lg">
                The things people usually want to know before their first form.
              </p>
            </div>

            <Accordion type="single" collapsible className="mt-12">
              {FAQS.map(({ q, a }) => (
                <AccordionItem key={q} value={q} className="border-ink/10">
                  <AccordionTrigger className="py-5 text-left text-base font-semibold text-ink hover:no-underline md:text-lg">
                    {q}
                  </AccordionTrigger>
                  <AccordionContent className="pb-5 text-base leading-relaxed text-ink/60">
                    {a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="relative overflow-hidden bg-ink px-6 py-24 md:px-8 md:py-32">
          <div className="relative mx-auto max-w-3xl text-center text-white">
            <h2 className="text-4xl font-extrabold tracking-tight text-balance md:text-6xl">
              Ask sharper. Learn faster.
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg text-white/60 md:text-xl">
              Ship your first Flowform in minutes — and never send a flat survey again.
            </p>
            <div className="mt-10 flex justify-center">
              <PrimaryCTA size="lg" variant="light">
                Start for free
              </PrimaryCTA>
            </div>
            <p className="mt-8 text-xs font-medium uppercase tracking-[0.2em] text-white/90">
              Free forever · No card required
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 bg-ink px-6 pt-16 pb-10 md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <a href="/" className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-brand">
                  <span className="size-3 rounded-sm bg-white" />
                </span>
                <span className="text-xl font-bold tracking-tight text-white">Flowform</span>
              </a>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/40">
                One-question-at-a-time forms that feel like a conversation — and get finished.
              </p>
            </div>
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
                Product
              </h3>
              <ul className="mt-4 space-y-3 text-sm">
                {[...NAV_LINKS, { href: "/demo", label: "Live demo" }].map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="text-white/60 transition-colors hover:text-white">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
                Account
              </h3>
              <ul className="mt-4 space-y-3 text-sm">
                <li>
                  <Link
                    to="/login"
                    search={{ redirect: "/dashboard" }}
                    className="text-white/60 transition-colors hover:text-white"
                  >
                    Log in
                  </Link>
                </li>
                <li>
                  <Link to="/signup" className="text-white/60 transition-colors hover:text-white">
                    Sign up
                  </Link>
                </li>
                <li>
                  <Link
                    to="/dashboard"
                    className="text-white/60 transition-colors hover:text-white"
                  >
                    Dashboard
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
                Legal
              </h3>
              <ul className="mt-4 space-y-3 text-sm">
                <li>
                  <Link to="/privacy" className="text-white/60 transition-colors hover:text-white">
                    Privacy policy
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="text-white/60 transition-colors hover:text-white">
                    Terms of service
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-14 flex flex-col items-center gap-4 border-t border-white/10 pt-8 text-sm text-white/40 sm:flex-row sm:justify-between">
            <p>&copy; {new Date().getFullYear()} Flowform. All rights reserved.</p>
            <p className="flex items-center gap-1.5">
              Built by Andrius
              <a
                href="https://github.com/andriuskleinas"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-white/60 transition-colors hover:text-white"
              >
                <Github className="size-4" />
                andriuskleinas
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
