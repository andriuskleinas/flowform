import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign up — Flowform" },
      { name: "description", content: "Create your Flowform account." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Set once signUp requires email confirmation; switches the page to the
  // "check your inbox" card.
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard" });
  }, [loading, session, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const redirectUrl = `${window.location.origin}/dashboard`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectUrl },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      if (data.session) {
        toast.success("Welcome to Flowform");
        navigate({ to: "/dashboard" });
      } else {
        // No session means the account needs email confirmation first (also
        // the shape returned for an already-registered address, so this stays
        // safe against account enumeration).
        setConfirmationSentTo(email);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not create account. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resendConfirmation = async () => {
    if (!confirmationSentTo) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: confirmationSentTo,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) toast.error(error.message);
      else toast.success("Confirmation email sent again");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend the email.");
    } finally {
      setResending(false);
    }
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
        {confirmationSentTo ? (
          <div className="rounded-2xl border border-ink/5 bg-white p-8 text-center shadow-sm">
            <MailCheck className="mx-auto size-12 text-brand" />
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Check your inbox</h1>
            <p className="mt-3 text-ink/60">
              We sent a confirmation link to{" "}
              <span className="font-semibold text-ink">{confirmationSentTo}</span>. Click it to
              activate your account — then you'll land right in your dashboard.
            </p>
            <p className="mt-3 text-sm text-ink/50">
              Nothing there? Check your spam folder, or resend the email.
            </p>
            <button
              type="button"
              onClick={resendConfirmation}
              disabled={resending}
              className="mt-6 inline-flex items-center justify-center rounded-full border border-ink/15 px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-ink/30 disabled:opacity-50"
            >
              {resending ? "Resending…" : "Resend confirmation email"}
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
              Create your account
            </h1>
            <p className="mt-2 text-ink/60">Start building forms in seconds.</p>
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
                <Label htmlFor="password">Password</Label>
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
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground transition-all hover:shadow-lg hover:shadow-brand/25 disabled:opacity-50"
              >
                {submitting ? "Creating account…" : "Sign up"}
              </button>
              <p className="text-center text-sm text-ink/60">
                Already have an account?{" "}
                <Link
                  to="/login"
                  search={{ redirect: "/dashboard" }}
                  className="font-semibold text-brand hover:underline"
                >
                  Log in
                </Link>
              </p>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
