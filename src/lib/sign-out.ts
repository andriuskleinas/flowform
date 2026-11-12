import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

/**
 * True from the moment "Log out" is clicked until the landing page loads.
 * Signed-in pages redirect to /login when the session disappears; while this
 * is set they skip that, so logging out lands on "/" and not on a login page
 * that points back to where you just left.
 */
let signingOut = false;
export const isSigningOut = () => signingOut;

export function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return async () => {
    signingOut = true;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err) {
      signingOut = false;
      toast.error(err instanceof Error ? err.message : "Couldn’t log out. Try again.");
      return;
    }
    queryClient.clear();
    try {
      await navigate({ to: "/" });
    } finally {
      signingOut = false;
    }
  };
}
