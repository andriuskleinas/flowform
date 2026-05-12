import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, GitBranch, Palette, BarChart3 } from "lucide-react";
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

const features = [
  {
    icon: GitBranch,
    title: "Step-by-step logic",
    body: "Create personalized paths for every respondent. Ask the right follow-up questions based on previous answers — automatically.",
  },
  {
    icon: Palette,
    title: "Beautiful themes",
    body: "Make it your own with custom fonts, colors, and backgrounds. Your brand shouldn't stop at the form header.",
  },
  {
    icon: BarChart3,
    title: "Deep analytics",
    body: "See exactly where people drop off. Get real-time insights into response times and completion rates.",
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
              Forms that feel like a{" "}
              <span className="text-brand">conversation.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink/60 md:mt-8 md:text-xl">
              Stop sending boring spreadsheets. Flowform helps you build
              engaging, one-question-at-a-time experiences that people actually
              enjoy filling out.
            </p>
            <div className="mt-10 flex justify-center md:mt-12">
              <PrimaryCTA size="lg">Create your first form</PrimaryCTA>
            </div>

            {/* Preview */}
            <div className="relative mt-16 md:mt-20">
              <div
                aria-hidden
                className="absolute -inset-6 rounded-[40px] bg-gradient-to-b from-brand/15 to-transparent blur-2xl"
              />
              <div className="relative overflow-hidden rounded-2xl border border-ink/5 bg-white shadow-2xl">
                <img
                  src={heroPreview}
                  alt="A Flowform conversational form asking one question at a time"
                  width={1536}
                  height={1024}
                  className="h-auto w-full"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-y border-ink/5 bg-white px-6 py-24 md:px-8 md:py-32">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-extrabold tracking-tight text-balance md:text-5xl">
                Everything you need to ask better questions.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base text-ink/60 md:text-lg">
                Thoughtful primitives for forms that adapt, brand-match, and
                actually get finished.
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
              Ready to collect better data?
            </h2>
            <p className="relative mx-auto mt-5 max-w-xl text-base text-white/60 md:mt-6 md:text-xl">
              Build a form your audience will actually finish.
            </p>
            <div className="relative mt-8 flex justify-center md:mt-10">
              <PrimaryCTA size="lg" variant="light">
                Start building for free
              </PrimaryCTA>
            </div>
            <p className="relative mt-6 text-xs font-medium uppercase tracking-[0.2em] text-white/40">
              No credit card required
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
