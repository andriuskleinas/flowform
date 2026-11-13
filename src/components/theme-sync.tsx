import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  isThemePref,
  readThemePref,
  setThemeActive,
  setThemePref,
  useThemeEffects,
} from "@/lib/theme";

/**
 * Applies the theme everywhere and, once per sign-in, adopts the theme saved
 * on the account so the preference follows the user across devices. Logged
 * out, the preference is switched off and every page is light.
 */
export function ThemeSync() {
  useThemeEffects();
  const { user, loading } = useAuth();
  const uid = user?.id;

  // Wait for auth to resolve: during the loading window there is no session
  // yet, and switching to light then would flash a dark-mode user's page.
  useEffect(() => {
    if (!loading) setThemeActive(!!uid);
  }, [loading, uid]);

  const { data } = useQuery({
    queryKey: ["profile-theme", uid],
    enabled: !!uid,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("theme")
        .eq("id", uid!)
        .maybeSingle();
      if (error) throw error;
      return data?.theme ?? null;
    },
  });

  const adoptedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!uid || adoptedFor.current === uid || data === undefined) return;
    adoptedFor.current = uid;
    if (isThemePref(data) && data !== readThemePref()) setThemePref(data);
  }, [uid, data]);

  return null;
}
