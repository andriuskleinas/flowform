import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const profileKey = (userId: string) => ["profile", userId] as const;

/** The signed-in user's name fields (shared cache entry across the app). */
export function useProfile(userId: string) {
  return useQuery({
    queryKey: profileKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, first_name, last_name")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

type NameFields = {
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
} | null;

/** "Ada Lovelace", falling back to the display name; empty when neither is set. */
export function fullNameOf(profile: NameFields | undefined) {
  const full = [profile?.first_name, profile?.last_name]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ");
  return full || profile?.display_name?.trim() || "";
}
