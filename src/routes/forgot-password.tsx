import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/auth-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        <div className="rounded-2xl border border-hairline bg-white p-8 text-center">
          <MailCheck className="mx-auto size-12 text-brand" />
          <h1 className="font-display mt-4 text-2xl">Check your inbox</h1>
          <p className="mt-3 text-ink/60">
            If <span className="font-semibold text-ink">{sentTo}</span> has a Flowform account, we
            just sent it a link to choose a new password. The link expires in an hour.
          </p>
          <p className="mt-3 text-sm text-ink/50">Nothing there? Check your spam folder.</p>
          <Link
            to="/login"
            search={{ redirect: "/dashboard" }}
            className="mt-6 inline-flex items-center justify-center rounded-md border border-ink/15 px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-ink/30"
          >
            Back to log in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="font-display text-3xl md:text-4xl">Reset your password</h1>
      <p className="mt-2 text-ink/60">
        Enter your email and we'll send you a link to choose a new one.
      </p>
      <form
        onSubmit={onSubmit}
        className="mt-8 space-y-5 rounded-2xl border border-hairline bg-white p-6"
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
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground transition-all disabled:opacity-50 hover:bg-brand/90"
        >
          {submitting ? "Sending link…" : "Send reset link"}
        </button>
        <p className="text-center text-sm text-ink/60">
          Remembered it?{" "}
          <Link
            to="/login"
            search={{ redirect: "/dashboard" }}
            className="font-semibold text-brand hover:underline"
          >
            Log in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
