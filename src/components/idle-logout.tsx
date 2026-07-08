import { useEffect } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { reportError } from "@/lib/error-capture";

const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const CHECK_INTERVAL_MS = 30_000;
// Activity writes are throttled, so the recorded timestamp can lag real
// activity by up to this much — logout may land slightly early, never late.
const WRITE_THROTTLE_MS = 10_000;
const STORAGE_KEY = "flowform:last-activity";

const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart"] as const;

/**
 * Signs the user out after 10 minutes without interaction. Renders nothing;
 * mounted once at the root. The last-activity timestamp lives in localStorage
 * so activity in any tab keeps every tab's session alive, and a stale
 * timestamp is caught on mount (page reopened later), on tab wake, and on a
 * periodic tick. Route guards handle the redirect once the session is gone.
 */
export function IdleLogout() {
  const { session, loading } = useAuth();
  const active = Boolean(session);

  useEffect(() => {
    // While auth is still resolving there is no session yet — clearing the
    // stored timestamp here would erase the very staleness we need to detect
    // right after a reload.
    if (loading) return;
    if (!active) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // storage unavailable — nothing to clean up
      }
      return;
    }

    let signedOut = false;
    let lastWrite = 0;

    const signOutIdle = () => {
      if (signedOut) return;
      signedOut = true;
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
      toast.info("You've been logged out after 10 minutes of inactivity.");
      supabase.auth.signOut().then(({ error }) => {
        if (error) reportError(error, { source: "IdleLogout.signOut" });
      });
    };

    /** Returns true when the session was ended for idleness. */
    const checkIdle = () => {
      let last = 0;
      try {
        last = Number(localStorage.getItem(STORAGE_KEY)) || 0;
      } catch {
        return false;
      }
      if (last && Date.now() - last >= IDLE_TIMEOUT_MS) {
        signOutIdle();
        return true;
      }
      return false;
    };

    const touch = () => {
      const now = Date.now();
      if (signedOut || now - lastWrite < WRITE_THROTTLE_MS) return;
      lastWrite = now;
      try {
        localStorage.setItem(STORAGE_KEY, String(now));
      } catch {
        // ignore
      }
    };

    // Order matters: a stale timestamp from a previous visit must sign out
    // before touch() records fresh activity.
    if (checkIdle()) return;
    touch();

    const onVisible = () => {
      if (document.visibilityState === "visible" && !checkIdle()) touch();
    };

    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, touch, { passive: true });
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(checkIdle, CHECK_INTERVAL_MS);

    return () => {
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, touch);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
  }, [active, loading]);

  return null;
}
