import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AuthShell } from "@/components/auth-shell";

// How long to wait for the confirmation session before calling the link dead.
// The Supabase client picks the session out of the URL during init, so it
// normally arrives with the first auth event — this is only a backstop.
const SESSION_GRACE_MS = 5000;

export const Route = createFileRoute("/confirmed")({
  head: () => ({
    meta: [
      { title: "Email confirmed — Flowform" },
      { name: "description", content: "Your Flowform email address is confirmed." },
    ],
  }),
  component: ConfirmedPage,
});

function ConfirmedPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [expired, setExpired] = useState(false);
  // Confirming signs the account in — that is how Supabase verifies the link.
  // We deliberately end that session and hand the user to the login form, so
  // reaching the dashboard still requires the password.
  const handled = useRef(false);

  useEffect(() => {
    if (loading || handled.current || !session) return;
    handled.current = true;
    (async () => {
      const { error } = await supabase.auth.signOut();
      if (error) toast.error(error.message);
      navigate({
        to: "/login",
        search: { redirect: "/dashboard", confirmed: true },
        replace: true,
      });
    })();
  }, [loading, session, navigate]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!handled.current) setExpired(true);
    }, SESSION_GRACE_MS);
    return () => clearTimeout(t);
  }, []);

  if (expired) {
    return (
      <AuthShell>
        <div className="rounded-2xl border border-ink/5 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-extrabold tracking-tight">This link has expired</h1>
          <p className="mt-3 text-ink/60">
            Confirmation links work once. Log in and we'll send you a fresh one if your email still
            needs confirming.
          </p>
          <Link
            to="/login"
            search={{ redirect: "/dashboard" }}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground transition-all hover:shadow-lg hover:shadow-brand/25"
          >
            Go to log in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <p className="text-center text-ink/50">Confirming your email…</p>
    </AuthShell>
  );
}
