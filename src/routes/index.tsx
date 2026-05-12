import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, GitBranch, Palette, BarChart3 } from "lucide-react";
import { useRef } from "react";
import heroPreview from "@/assets/hero-preview.jpg";

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
  const sizing = size === "lg" ? "px-8 py-4 text-base" : "px-5 py-2.5 text-sm";
  const variantClass =
    variant === "brand"
      ? "bg-brand text-brand-foreground hover:shadow-lg hover:shadow-brand/25"
      : "bg-white text-ink hover:scale-[1.02]";
  return (
    <button
      type="button"
      data-cta="demo"
      onClick={() => {
        // wired to the demo form in a later step
      }}
      className={`inline-flex items-center gap-2 rounded-full font-semibold transition-all ${sizing} ${variantClass}`}
    >
      {children}
      <ArrowRight className="size-4" />
    </button>
  );
}

function HeroPreview() {
  const ref = useRef<HTMLDivElement>(null);

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const ry = (x - 0.5) * 12; // -6deg .. 6deg
    const rx = (0.5 - y) * 12;
    el.style.setProperty("--rx", `${rx}deg`);
    el.style.setProperty("--ry", `${ry}deg`);
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
    el.style.setProperty("--glow", "1");
  };

  const handleLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--glow", "0");
  };

  return (
    <div
      className="group relative mt-16 motion-safe:animate-[hero-rise_0.7s_ease-out_both] md:mt-20"
      style={{ perspective: "1200px" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-10 overflow-hidden rounded-[48px] transition-opacity duration-500"
        style={{ opacity: "calc(0.75 + 0.35 * var(--glow, 0))" }}
      >
        <div
          className="absolute left-1/2 top-1/2 size-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/40 blur-3xl will-change-transform motion-safe:animate-[aurora-drift-a_14s_ease-in-out_infinite]"
          style={{ mixBlendMode: "screen" }}
        />
        <div
          className="absolute left-1/2 top-1/2 size-[55%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-300/40 blur-3xl will-change-transform motion-safe:animate-[aurora-drift-b_18s_ease-in-out_infinite]"
          style={{ mixBlendMode: "screen" }}
        />
        <div className="absolute inset-6 rounded-[40px] border border-brand/20 motion-safe:animate-[aurora-pulse_6s_ease-in-out_infinite]" />
      </div>
      <div
        ref={ref}
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
        className="relative overflow-hidden rounded-2xl border border-ink/5 bg-white shadow-2xl transition-transform duration-300 ease-out motion-safe:animate-[float_6s_ease-in-out_infinite] will-change-transform"
        style={{
          transform:
            "perspective(1200px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))",
          transformStyle: "preserve-3d",
        }}
      >
        <img
          src={heroPreview}
          alt="A Flowform conversational form asking one question at a time"
          width={1536}
          height={1024}
          className="h-auto w-full"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(circle 240px at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,0.5), transparent 70%)",
            mixBlendMode: "soft-light",
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
    role: "Head of Research @ Northwind",
  },
  {
    quote:
      "It finally looks like our brand. Customers actually finish the form.",
    name: "Daniel Ortiz",
    role: "Design Lead @ Lumen",
  },
  {
    quote:
      "The drop-off insights are surgical. We rewrote our onboarding in an afternoon.",
    name: "Priya Raman",
    role: "Growth @ Axiom",
  },
];

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
            <PrimaryCTA>Get started</PrimaryCTA>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="px-6 pt-16 pb-24 md:px-8 md:pt-20 md:pb-32">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight text-balance md:text-7xl">
              Forms, finally{" "}
              <span className="text-brand">worth finishing.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink/60 md:mt-8 md:text-xl">
              Craft beautifully simple, one-question-at-a-time experiences that
              feel less like a survey and more like a conversation worth having.
            </p>
            <div className="mt-10 flex justify-center md:mt-12">
              <PrimaryCTA size="lg">Start building</PrimaryCTA>
            </div>

            {/* Preview */}
            <HeroPreview />
          </div>
        </section>

        {/* Social proof */}
        <section className="px-6 pb-24 md:px-8 md:pb-32">
          <div className="mx-auto max-w-7xl">
            <ul className="grid gap-6 md:grid-cols-3">

              {testimonials.map((t) => (
                <li
                  key={t.name}
                  className="flex flex-col rounded-2xl border border-ink/5 bg-white p-8 shadow-sm"
                >
                  <p className="min-h-[7rem] text-lg leading-relaxed text-ink/80 md:min-h-[8rem]">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div className="mt-8 text-sm">
                    <div className="font-semibold text-ink">{t.name}</div>
                    <div className="text-ink/50">{t.role}</div>
                  </div>
                </li>
              ))}
            </ul>
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
        <section className="px-6 py-24 md:px-8 md:py-32">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[32px] bg-ink p-10 text-center text-white md:rounded-[40px] md:p-16">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-20 right-0 size-64 translate-x-1/3 rounded-full bg-brand/30 blur-[100px]"
            />
            <h2 className="relative text-3xl font-extrabold tracking-tight text-balance md:text-5xl">
              Ask sharper. Learn faster.
            </h2>
            <p className="relative mx-auto mt-5 max-w-xl text-base text-white/60 md:mt-6 md:text-xl">
              Ship your first Flowform in minutes — and never send a flat
              survey again.
            </p>
            <div className="relative mt-8 flex justify-center md:mt-10">
              <PrimaryCTA size="lg" variant="light">
                Start for free
              </PrimaryCTA>
            </div>
            <p className="relative mt-6 text-xs font-medium uppercase tracking-[0.2em] text-white/40">
              Free forever · No card required
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-ink/5 px-6 py-10 md:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between text-sm text-ink/40">
          <span>&copy; {new Date().getFullYear()} Flowform</span>
          <div className="flex gap-6">
            <a href="/" className="hover:text-ink">Privacy</a>
            <a href="/" className="hover:text-ink">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
