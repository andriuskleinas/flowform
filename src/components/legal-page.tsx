import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <header className="border-b border-ink/5 bg-surface/85 backdrop-blur-md">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-8">
          <a href="/" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand">
              <span className="size-3 rounded-sm bg-white" />
            </span>
            <span className="text-xl font-bold tracking-tight">Flowform</span>
          </a>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-ink/60 transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-4" />
            Back home
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16 md:px-8 md:py-20">
        <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-ink/50">Last updated: {updated}</p>
        <div className="mt-10 space-y-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-tight [&_p]:mt-3 [&_p]:leading-relaxed [&_p]:text-ink/70 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_li]:leading-relaxed [&_li]:text-ink/70">
          {children}
        </div>
      </main>

      <footer className="border-t border-ink/5 px-6 py-8 md:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between text-sm text-ink/40">
          <span>&copy; {new Date().getFullYear()} Flowform</span>
          <Link to="/" className="transition-colors hover:text-ink">
            flowformapp.vercel.app
          </Link>
        </div>
      </footer>
    </div>
  );
}
