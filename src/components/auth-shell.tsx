import { Link } from "@tanstack/react-router";

/** Shared chrome for the signed-out auth pages (login, signup, password reset). */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <header className="border-b border-ink/5">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 md:px-8">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand">
              <span className="size-3 rounded-sm bg-white" />
            </span>
            <span className="text-xl font-bold tracking-tight">Flowform</span>
          </Link>
        </nav>
      </header>
      <main className="mx-auto flex max-w-md flex-col px-6 pb-24 pt-16 md:px-8">{children}</main>
    </div>
  );
}
