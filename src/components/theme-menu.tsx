import { useQueryClient } from "@tanstack/react-query";
import { Monitor, Moon, Sun } from "lucide-react";

import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { isThemePref, setThemePref, useThemePref } from "@/lib/theme";

/** "Theme" submenu for account dropdowns; persists to the profile too. */
export function ThemeSubmenu({ userId }: { userId: string }) {
  const pref = useThemePref();
  const qc = useQueryClient();
  const Icon = pref === "dark" ? Moon : pref === "system" ? Monitor : Sun;

  const choose = (v: string) => {
    if (!isThemePref(v) || v === pref) return;
    setThemePref(v);
    qc.setQueryData(["profile-theme", userId], v);
    // Best effort: the local choice already applied; the account copy just syncs devices.
    void supabase.from("profiles").update({ theme: v }).eq("id", userId);
  };

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Icon className="size-4" />
        Theme
        <span className="ml-auto pl-3 text-xs capitalize text-ink/45">{pref}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup value={pref} onValueChange={choose}>
          <DropdownMenuRadioItem value="light">
            <Sun className="size-4" /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="size-4" /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor className="size-4" /> System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
