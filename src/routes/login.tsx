import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AuthShell } from "@/components/auth-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  // `confirmed` is optional in the return type on purpose: spelling it as
  // `confirmed: boolean | undefined` would make every existing `to="/login"`
  // link pass it explicitly.
  validateSearch: (s: Record<string, unknown>): { redirect: string; confirmed?: true } => ({
    redirect: typeof s.redirect === "string" ? s.redirect : "/dashboard",
    // Set by /confirmed, so the user knows the click worked and why they're
    // being asked to log in.
    ...(s.confirmed === true || s.confirmed === "true" ? { confirmed: true as const } : {}),
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
  const { redirect, confirmed } = useSearch({ from: "/login" });
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // The email of an account that tried to log in before confirming, if any.
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: redirect });
  }, [loading, session, navigate, redirect]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const notConfirmed =
          ("code" in error && error.code === "email_not_confirmed") ||
          error.message.toLowerCase().includes("not confirmed");
        if (notConfirmed) {
          setUnconfirmedEmail(email);
          return;
        }
        toast.error(error.message);
        return;
      }
      setUnconfirmedEmail(null);
      navigate({ to: redirect });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not log in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const resendConfirmation = async () => {
    if (!unconfirmedEmail) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: unconfirmedEmail,
        options: { emailRedirectTo: `${window.location.origin}/confirmed` },
      });
      if (error) toast.error(error.message);
      else toast.success("Confirmation email sent — check your inbox");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend the email.");
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell>
      <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Welcome back</h1>
      <p className="mt-2 text-ink/60">
        New here?{" "}
        <Link to="/signup" className="font-semibold text-brand hover:underline">
          Create an account
        </Link>
      </p>
      {confirmed && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <p>
            <span className="font-semibold">Email confirmed.</span> Log in to reach your dashboard.
          </p>
        </div>
      )}
      <form
        onSubmit={onSubmit}
        className="mt-8 space-y-5 rounded-2xl border border-ink/5 bg-white p-6 shadow-sm"
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="password">Password</Label>
            <Link
              to="/forgot-password"
              search={{ email: email || undefined }}
              className="text-sm font-medium text-brand hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {unconfirmedEmail && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p>
              <span className="font-semibold">{unconfirmedEmail}</span> hasn't been verified yet.
              Click the confirmation link we emailed you, then log in.
            </p>
            <button
              type="button"
              onClick={resendConfirmation}
              disabled={resending}
              className="mt-2 font-semibold underline underline-offset-2 hover:text-amber-700 disabled:opacity-50"
            >
              {resending ? "Resending…" : "Resend confirmation email"}
            </button>
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground transition-all hover:shadow-lg hover:shadow-brand/25 disabled:opacity-50"
        >
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
    </AuthShell>
  );
}
