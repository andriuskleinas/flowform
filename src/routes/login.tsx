import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AuthField, AuthShell } from "@/components/auth-shell";
import { validateEmail } from "@/lib/auth-validation";

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
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null }>({});

  useEffect(() => {
    if (!loading && session) navigate({ to: redirect });
  }, [loading, session, navigate, redirect]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = {
      email: validateEmail(email),
      password: password ? null : "Enter your password.",
    };
    setErrors(next);
    if (next.email || next.password) return;
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
      toast.error(err instanceof Error ? err.message : "Couldn’t log in. Try again in a moment.");
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
      else toast.success("Confirmation email sent. Check your inbox.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn’t resend the email. Try again in a moment.",
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell panel="login">
      <h1 className="font-display text-4xl">Welcome back</h1>
      <p className="mt-2 text-ink/60">Your forms are where you left them.</p>
      {confirmed && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <p>
            <span className="font-semibold">Email confirmed.</span> Log in to reach your dashboard.
          </p>
        </div>
      )}
      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
        <AuthField
          label="Email"
          icon={Mail}
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email) setErrors((x) => ({ ...x, email: null }));
          }}
          autoComplete="off"
          placeholder="you@example.com"
          error={errors.email}
          autoFocus
        />
        <AuthField
          label="Password"
          icon={Lock}
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (errors.password) setErrors((x) => ({ ...x, password: null }));
          }}
          autoComplete="current-password"
          placeholder="Your password"
          error={errors.password}
          labelAction={
            <Link
              to="/forgot-password"
              search={{ email: email || undefined }}
              className="text-xs font-medium text-brand hover:underline"
            >
              Forgot password?
            </Link>
          }
        />
        {unconfirmedEmail && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p>
              <span className="font-semibold">{unconfirmedEmail}</span> hasn’t been confirmed yet.
              Click the link we emailed you, then log in.
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
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand px-5 text-sm font-semibold text-brand-foreground transition-all hover:bg-brand/90 disabled:opacity-60"
        >
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="mt-8 border-t border-hairline pt-6 text-center text-sm text-ink/60">
        New to Flowform?{" "}
        <Link to="/signup" className="font-semibold text-brand hover:underline">
          Create a free account
        </Link>
      </p>
    </AuthShell>
  );
}
