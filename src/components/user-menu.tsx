import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { LogOut, User } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { getInitialsFromProfile } from "@/lib/utils";

// Re-exported for backwards compatibility with existing imports.
// Prefer importing `getInitialsFromProfile` from "@/lib/utils" directly.
export const getInitials = getInitialsFromProfile;

export function UserMenu({ userId, email }: { userId: string; email: string }) {
  const navigate = useNavigate();
  const signingOutRef = useRef(false);

  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
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

  const fullName = [profile?.first_name, profile?.last_name]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ");

  const handleSignOut = async () => {
    signingOutRef.current = true;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err) {
      signingOutRef.current = false;
      const message = err instanceof Error ? err.message : "Could not sign out.";
      toast.error(message);
      return;
    }
    navigate({ to: "/" });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open account menu"
        className="flex size-9 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand outline-none transition-all hover:bg-brand/15 focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        {getInitialsFromProfile(profile?.first_name, profile?.last_name, profile?.display_name, email)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-2 py-2">
          <p className="truncate text-sm font-semibold text-ink">
            {fullName || profile?.display_name?.trim() || "Account"}
          </p>
          <p className="truncate text-xs text-ink/60">{email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: "/dashboard" })}>
          <User className="size-4" />
          Dashboard
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
          <User className="size-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
