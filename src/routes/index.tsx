import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, GitBranch, Palette, BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { UserMenu } from "@/components/user-menu";
import logoNorthwind from "@/assets/logo-northwind.png";
import logoLumen from "@/assets/logo-lumen.png";
import logoAxiom from "@/assets/logo-axiom.png";
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
  const sizing = size === "lg" ? "px-8 py-4 text-base" : "px-5 py-2.5 text-sm";
  const variantClass =
    variant === "brand"
      ? "bg-brand text-brand-foreground hover:shadow-lg hover:shadow-brand/25"
      : "bg-white text-ink hover:scale-[1.02]";
  return (
    <Link
      to={to}
      data-cta="get-started"
      className={`inline-flex items-center gap-2 rounded-full font-semibold transition-all ${sizing} ${variantClass}`}
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

const testimonials = [
  {
    quote:
      "We replaced three survey tools with one Flowform. Response rates doubled in a week.",
    name: "Maya Chen",
    role: "Head of Research",
    company: "Northwind",
    logo: logoNorthwind,
  },
  {
    quote:
      "It finally looks like our brand. Customers actually finish the form.",
    name: "Daniel Ortiz",
    role: "Design Lead",
    company: "Lumen",
    logo: logoLumen,
  },
  {
    quote:
      "The drop-off insights are surgical. We rewrote our onboarding in an afternoon.",
    name: "Priya Raman",
    role: "Growth",
    company: "Axiom",
    logo: logoAxiom,
  },
];

function TestimonialsCarousel() {
  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!api) return;
    setCount(api.scrollSnapList().length);
    setSelected(api.selectedScrollSnap());
    api.on("select", () => setSelected(api.selectedScrollSnap()));
  }, [api]);

  useEffect(() => {
    if (!api) return;
    const id = setInterval(() => api.scrollNext(), 6000);
    return () => clearInterval(id);
  }, [api]);

  return (
    <Carousel
      setApi={setApi}
      opts={{ loop: true, align: "start" }}
      className="mx-auto w-full max-w-6xl"
    >
      <CarouselContent className="-ml-6">
        {testimonials.map((t) => (
          <CarouselItem
            key={t.name}
            className="pl-6 md:basis-1/2 lg:basis-1/3"
          >
            <article className="flex h-full flex-col rounded-2xl border border-ink/5 bg-white p-8 shadow-sm">
              <div className="flex items-center gap-3 pb-5">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">
                  {t.company}
                </span>
              </div>
              <div className="border-t border-ink/5" />
              <p className="mt-6 min-h-[7rem] text-lg leading-relaxed text-ink/80 md:min-h-[8rem]">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-8 text-sm">
                <div className="font-semibold text-ink">{t.name}</div>
                <div className="text-ink/50">{t.role}</div>
              </div>
            </article>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="hidden md:-left-12 md:flex" />
      <CarouselNext className="hidden md:-right-12 md:flex" />

      <div className="mt-8 flex justify-center gap-2">
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

const features = [
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
  },
];

function Index() {
  const { session } = useAuth();
  return (
    <div className="min-h-screen bg-surface text-ink">
      {/* Nav */}
      <header>
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 md:px-8">
          <a href="/" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand">
              <span className="size-3 rounded-sm bg-white" />
            </span>
            <span className="text-xl font-bold tracking-tight">Flowform</span>
          </a>
          <div className="flex items-center gap-6 md:gap-8">
            <a
              href="#features"
              className="hidden text-sm font-medium text-ink/60 transition-colors hover:text-ink sm:inline"
            >
              Features
            </a>
            {session ? (
              <>
                <Link
                  to="/dashboard"
                  className="hidden text-sm font-medium text-ink/60 transition-colors hover:text-ink sm:inline"
                >
                  Dashboard
                </Link>
                <UserMenu userId={session.user.id} email={session.user.email ?? ""} />
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden text-sm font-medium text-ink/60 transition-colors hover:text-ink sm:inline"
                >
                  Log in
                </Link>
                <PrimaryCTA>Get started</PrimaryCTA>
              </>
            )}
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section
          className="relative overflow-hidden px-6 pt-16 pb-24 md:px-8 md:pt-20 md:pb-32"
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
            <h1
              className="text-5xl font-extrabold leading-[1.05] tracking-tight text-balance transition-transform duration-200 ease-out md:text-7xl"
              style={{
                transform:
                  "translate3d(calc(var(--px, 0) * -0.025px), calc(var(--py, 0) * -0.025px), 0)",
              }}
            >
              Forms people{" "}
              <span className="text-brand">actually finish.</span>
            </h1>
            <p
              className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink/60 transition-transform duration-200 ease-out md:mt-8 md:text-xl"
              style={{
                transform:
                  "translate3d(calc(var(--px, 0) * -0.015px), calc(var(--py, 0) * -0.015px), 0)",
              }}
            >
              Craft beautifully simple, one-question-at-a-time experiences that
              feel less like a survey and more like a conversation worth having.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4 md:mt-12">
              <PrimaryCTA size="lg">Start building</PrimaryCTA>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-ink/70 transition-colors hover:text-ink"
              >
                Go to dashboard
                <ArrowRight className="size-4" />
              </Link>
            </div>

            {/* Preview */}
            <HeroPreview />
          </div>
        </section>

        {/* Social proof */}
        <section className="px-6 pb-24 md:px-8 md:pb-32">
          <div className="mx-auto max-w-7xl">
            <TestimonialsCarousel />
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-y border-ink/5 bg-white px-6 py-24 md:px-8 md:py-32">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-extrabold tracking-tight text-balance md:text-5xl">
                Built for the questions that matter.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base text-ink/60 md:text-lg">
                A precise toolkit for teams who treat every interaction
                like a first impression.
              </p>
            </div>

            <ul className="mt-16 grid gap-12 md:grid-cols-3">
              {features.map(({ icon: Icon, title, body }) => (
                <li key={title} className="space-y-5">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-brand/10">
                    <Icon className="size-5 text-brand" strokeWidth={2} />
                  </div>
                  <h3 className="text-xl font-bold tracking-tight md:text-2xl">{title}</h3>
                  <p className="leading-relaxed text-ink/60">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="relative overflow-hidden bg-ink px-6 py-24 md:px-8 md:py-32">
          <div
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-1/2 size-[420px] -translate-x-[60%] -translate-y-1/2 rounded-full bg-brand/25 blur-[120px]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-1/2 size-[420px] -translate-x-[40%] -translate-y-1/2 rounded-full bg-brand/25 blur-[120px]"
          />
          <div className="relative mx-auto max-w-3xl text-center text-white">
            <h2 className="text-4xl font-extrabold tracking-tight text-balance md:text-6xl">
              Ask sharper. Learn faster.
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg text-white/60 md:text-xl">
              Ship your first Flowform in minutes — and never send a flat
              survey again.
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

      <footer className="border-t border-white/5 bg-ink px-6 py-10 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-sm text-white/40 sm:flex-row">
          <a href="/" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand">
              <span className="size-3 rounded-sm bg-white" />
            </span>
            <span className="text-xl font-bold tracking-tight text-white">Flowform</span>
          </a>
          <span>&copy; {new Date().getFullYear()} Flowform</span>
        </div>
      </footer>
    </div>
  );
}
