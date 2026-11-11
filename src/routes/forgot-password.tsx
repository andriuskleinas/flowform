import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Mail, MailCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AuthField, AuthShell } from "@/components/auth-shell";
import { validateEmail } from "@/lib/auth-validation";

export const Route = createFileRoute("/forgot-password")({
  validateSearch: (s: Record<string, unknown>) => ({
    email: typeof s.email === "string" ? s.email : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Reset your password — Flowform" },
      { name: "description", content: "Get a link to reset your Flowform password." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { email: prefill } = useSearch({ from: "/forgot-password" });
  const [email, setEmail] = useState(prefill ?? "");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateEmail(email);
    setEmailError(err);
    if (err) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      // Succeeds regardless of whether the address is registered — deliberately
      // no signal either way on this page.
      setSentTo(email);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not send the reset link. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (sentTo) {
    return (
      <AuthShell>
        <div className="text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand/10">
            <MailCheck className="size-7 text-brand" />
          </span>
          <h1 className="font-display mt-5 text-3xl">Check your inbox</h1>
          <p className="mt-3 text-ink/60">
            If <span className="font-semibold text-ink">{sentTo}</span> has a Flowform account, we
            just sent it a link to choose a new password. The link expires in an hour.
          </p>
          <p className="mt-3 text-sm text-ink/50">Nothing there? Check your spam folder.</p>
          <Link
            to="/login"
            search={{ redirect: "/dashboard" }}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-md border border-ink/15 bg-card px-5 text-sm font-semibold text-ink transition-colors hover:border-ink/30"
          >
            Back to log in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="font-display text-4xl">Reset your password</h1>
      <p className="mt-2 text-ink/60">
        Enter your email and we'll send you a link to choose a new one.
      </p>
      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
        <AuthField
          label="Email"
          icon={Mail}
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError(null);
          }}
          autoComplete="off"
          placeholder="you@example.com"
          error={emailError}
          autoFocus
        />
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand px-5 text-sm font-semibold text-brand-foreground transition-all hover:bg-brand/90 disabled:opacity-60"
        >
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {submitting ? "Sending link…" : "Send reset link"}
        </button>
      </form>
      <p className="mt-8 border-t border-hairline pt-6 text-center text-sm text-ink/60">
        Remembered it?{" "}
        <Link
          to="/login"
          search={{ redirect: "/dashboard" }}
          className="font-semibold text-brand hover:underline"
        >
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
