import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Loader2, Lock, Mail, MailCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AuthField, AuthShell } from "@/components/auth-shell";
import { validateEmail } from "@/lib/auth-validation";

const MIN_PASSWORD = 6;

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
  // The submitted address, when signUp reported it is already registered. Kept
  // as the email itself (not a flag) so editing the field hides the notice.
  const [existingEmail, setExistingEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null }>({});

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard" });
  }, [loading, session, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = {
      email: validateEmail(email),
      password:
        password.length >= MIN_PASSWORD
          ? null
          : `Use at least ${MIN_PASSWORD} characters for your password.`,
    };
    setErrors(next);
    if (next.email || next.password) return;
    setSubmitting(true);
    try {
      // Confirming lands on /confirmed, which ends the session Supabase creates
      // and sends the user to the login form — the dashboard needs a password.
      const redirectUrl = `${window.location.origin}/confirmed`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectUrl },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      // Email-enumeration protection makes signUp answer 200 for an address
      // that is already registered: it returns a fabricated user (even a
      // `confirmation_sent_at`) but sends no email at all. An empty identities
      // array is the one tell. Match it strictly — any other shape falls
      // through to "check your inbox", so a genuinely new signup is never
      // turned away.
      if (Array.isArray(data.user?.identities) && data.user.identities.length === 0) {
        setExistingEmail(email);
        return;
      }
      if (data.session) {
        toast.success("Welcome to Flowform");
        navigate({ to: "/dashboard" });
      } else {
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
        options: { emailRedirectTo: `${window.location.origin}/confirmed` },
      });
      if (error) toast.error(error.message);
      else toast.success("Confirmation email sent again");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend the email.");
    } finally {
      setResending(false);
    }
  };

  const passwordLongEnough = password.length >= MIN_PASSWORD;

  return (
    <AuthShell panel="signup">
      {confirmationSentTo ? (
        <div className="text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand/10">
            <MailCheck className="size-7 text-brand" />
          </span>
          <h1 className="font-display mt-5 text-3xl">Check your inbox</h1>
          <p className="mt-3 text-ink/60">
            We sent a confirmation link to{" "}
            <span className="font-semibold text-ink">{confirmationSentTo}</span>. Click it to
            activate your account, then log in.
          </p>
          <p className="mt-3 text-sm text-ink/50">
            Nothing there? Check your spam folder, or resend the email.
          </p>
          <button
            type="button"
            onClick={resendConfirmation}
            disabled={resending}
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-5 text-sm font-semibold text-ink transition-colors hover:border-ink/30 disabled:opacity-50"
          >
            {resending && <Loader2 className="size-4 animate-spin" />}
            {resending ? "Resending…" : "Resend confirmation email"}
          </button>
          <p className="mt-8 text-sm text-ink/60">
            Already confirmed?{" "}
            <Link
              to="/login"
              search={{ redirect: "/dashboard" }}
              className="font-semibold text-brand hover:underline"
            >
              Log in
            </Link>
          </p>
        </div>
      ) : (
        <>
          <h1 className="font-display text-4xl">Create your account</h1>
          <p className="mt-2 text-ink/60">Build your first conversational form in minutes.</p>
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
              autoComplete="new-password"
              placeholder="Create a password"
              error={errors.password}
              hint={
                <span
                  className={
                    "inline-flex items-center gap-1 transition-colors " +
                    (passwordLongEnough ? "text-emerald-700" : "")
                  }
                >
                  {passwordLongEnough && <Check className="size-3" />}
                  At least {MIN_PASSWORD} characters
                </span>
              }
            />
            {existingEmail === email && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p>
                  <span className="font-semibold">{existingEmail}</span> already has a Flowform
                  account.
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link
                    to="/login"
                    search={{ redirect: "/dashboard" }}
                    className="font-semibold underline underline-offset-2 hover:text-amber-700"
                  >
                    Log in instead
                  </Link>
                  <span aria-hidden className="text-amber-900/40">
                    ·
                  </span>
                  <Link
                    to="/forgot-password"
                    search={{ email: existingEmail }}
                    className="font-semibold underline underline-offset-2 hover:text-amber-700"
                  >
                    Forgot your password?
                  </Link>
                </p>
              </div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand px-5 text-sm font-semibold text-brand-foreground transition-all hover:bg-brand/90 disabled:opacity-60"
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {submitting ? "Creating account…" : "Create account"}
            </button>
            <p className="text-center text-xs leading-relaxed text-ink/50">
              By creating an account you agree to the{" "}
              <Link to="/terms" className="underline underline-offset-2 hover:text-ink">
                Terms
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className="underline underline-offset-2 hover:text-ink">
                Privacy Policy
              </Link>
              .
            </p>
          </form>
          <p className="mt-8 border-t border-hairline pt-6 text-center text-sm text-ink/60">
            Already have an account?{" "}
            <Link
              to="/login"
              search={{ redirect: "/dashboard" }}
              className="font-semibold text-brand hover:underline"
            >
              Log in
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
