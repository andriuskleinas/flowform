import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : "/dashboard",
  }),
  head: () => ({
    meta: [
      { title: "Log in — Flowform" },
      { name: "description", content: "Log in to your Flowform account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/login" });
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: redirect });
  }, [loading, session, navigate, redirect]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: redirect });
  };

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
      <main className="mx-auto flex max-w-md flex-col px-6 pb-24 pt-16 md:px-8">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Welcome back</h1>
        <p className="mt-2 text-ink/60">Log in to your Flowform account.</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-5 rounded-2xl border border-ink/5 bg-white p-6 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground transition-all hover:shadow-lg hover:shadow-brand/25 disabled:opacity-50"
          >
            {submitting ? "Logging in…" : "Log in"}
          </button>
          <p className="text-center text-sm text-ink/60">
            Don't have an account?{" "}
            <Link to="/signup" className="font-semibold text-brand hover:underline">Sign up</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
