import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { KeyRound, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AuthField, AuthShell } from "@/components/auth-shell";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (s: Record<string, unknown>) => ({
    token_hash: typeof s.token_hash === "string" ? s.token_hash : undefined,
    type: typeof s.type === "string" ? s.type : undefined,
  }),
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
  const { token_hash } = useSearch({ from: "/reset-password" });
  // Two link shapes reach this page, and both must work:
  //   - new: ?token_hash=… on our own domain, redeemed here via verifyOtp
  //   - old: a recovery session in the URL hash, which the Supabase client
  //     picks up on init — still live in any reset email already sent
  // Either way, "no session once auth has settled" means expired or used.
  const { session, loading } = useAuth();
  const [verifying, setVerifying] = useState(Boolean(token_hash));
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ password?: string | null; confirm?: string | null }>({});
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token_hash) return;
    let cancelled = false;
    (async () => {
      const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash });
      if (cancelled) return;
      if (!error) {
        // Drop the token from the URL before it reaches history or a referrer
        // header. Replace, so Back doesn't return to a spent token.
        navigate({
          to: "/reset-password",
          search: { token_hash: undefined, type: undefined },
          replace: true,
        });
      }
      setVerifying(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token_hash, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = {
      password: password.length >= 6 ? null : "Use at least 6 characters.",
      confirm: confirm === password ? null : "Those passwords don't match.",
    };
    setErrors(next);
    if (next.password || next.confirm) return;
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

  // `verifying` matters: auth settles to "no session" while verifyOtp is still
  // in flight, which would flash the expired card on a perfectly good link.
  if (loading || verifying) {
    return (
      <AuthShell>
        <p className="text-center text-ink/50">Checking your link…</p>
      </AuthShell>
    );
  }

  if (!session) {
    return (
      <AuthShell>
        <div className="text-center">
          <h1 className="font-display text-3xl">This link has expired</h1>
          <p className="mt-3 text-ink/60">
            Password reset links work once and expire after an hour. Request a fresh one and we'll
            email it right over.
          </p>
          <Link
            to="/forgot-password"
            search={{ email: undefined }}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-brand px-5 text-sm font-semibold text-brand-foreground transition-all hover:bg-brand/90"
          >
            Send a new link
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="font-display text-4xl">Choose a new password</h1>
      <p className="mt-2 text-ink/60">
        Setting a new password for{" "}
        <span className="font-semibold text-ink">{session.user.email}</span>.
      </p>
      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
        <AuthField
          label="New password"
          icon={Lock}
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (errors.password) setErrors((x) => ({ ...x, password: null }));
          }}
          autoComplete="new-password"
          placeholder="At least 6 characters"
          error={errors.password}
          autoFocus
        />
        <AuthField
          label="Confirm new password"
          icon={Lock}
          type="password"
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            if (errors.confirm) setErrors((x) => ({ ...x, confirm: null }));
          }}
          autoComplete="new-password"
          placeholder="Type it again"
          error={errors.confirm}
        />
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand px-5 text-sm font-semibold text-brand-foreground transition-all hover:bg-brand/90 disabled:opacity-60"
        >
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <KeyRound className="size-4" />
          )}
          {submitting ? "Saving…" : "Save new password"}
        </button>
      </form>
    </AuthShell>
  );
}
