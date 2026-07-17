import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AuthShell } from "@/components/auth-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — Flowform" },
      { name: "description", content: "Choose a new password for your Flowform account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  // Following the emailed link puts a recovery session in the URL, which the
  // Supabase client picks up on init. So "no session once auth has settled"
  // is what an expired or already-used link looks like here.
  const { session, loading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Those passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Password updated — you're logged in.");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not update your password. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AuthShell>
        <p className="text-center text-ink/50">Checking your link…</p>
      </AuthShell>
    );
  }

  if (!session) {
    return (
      <AuthShell>
        <div className="rounded-2xl border border-ink/5 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-extrabold tracking-tight">This link has expired</h1>
          <p className="mt-3 text-ink/60">
            Password reset links work once and expire after an hour. Request a fresh one and we'll
            email it right over.
          </p>
          <Link
            to="/forgot-password"
            search={{ email: undefined }}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground transition-all hover:shadow-lg hover:shadow-brand/25"
          >
            Send a new link
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Choose a new password</h1>
      <p className="mt-2 text-ink/60">
        Setting a new password for{" "}
        <span className="font-semibold text-ink">{session.user.email}</span>.
      </p>
      <form
        onSubmit={onSubmit}
        className="mt-8 space-y-5 rounded-2xl border border-ink/5 bg-white p-6 shadow-sm"
      >
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm new password</Label>
          <Input
            id="confirm"
            type="password"
            required
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground transition-all hover:shadow-lg hover:shadow-brand/25 disabled:opacity-50"
        >
          <KeyRound className="mr-2 size-4" />
          {submitting ? "Saving…" : "Save new password"}
        </button>
      </form>
    </AuthShell>
  );
}
