import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { reportError } from "@/lib/error-capture";

/**
 * Subscribes to Supabase auth state changes.
 *
 * Returns:
 *   - session: the current Session (or null)
 *   - user:    convenience accessor for session?.user
 *   - loading: true until the first auth event has been received
 *   - error:   an Error if subscription setup failed, otherwise null. Consumers
 *              can render a recovery affordance instead of hanging in loading.
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION on setup, so getSession() is redundant.
    let subscription: { unsubscribe: () => void } | undefined;
    try {
      const result = supabase.auth.onAuthStateChange((_event, s) => {
        setSession(s);
        setLoading(false);
        setError(null);
      });
      subscription = result.data.subscription;
    } catch (err) {
      const e = err instanceof Error ? err : new Error("Failed to subscribe to auth state");
      reportError(e, { source: "useAuth.subscribe" });
      setError(e);
      setLoading(false);
    }
    return () => subscription?.unsubscribe();
  }, []);

  return { session, user: session?.user ?? null, loading, error };
}
