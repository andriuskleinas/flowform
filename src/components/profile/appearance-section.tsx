import { useQueryClient } from "@tanstack/react-query";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { setThemePref, useThemePref, type ThemePref } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { ProfileSection } from "./section";

const OPTIONS: { value: ThemePref; label: string; hint: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", hint: "Ink on warm paper", Icon: Sun },
  { value: "dark", label: "Dark", hint: "Easy on the eyes at night", Icon: Moon },
  { value: "system", label: "System", hint: "Follows your device", Icon: Monitor },
];

/** Tiny static mock of the app in a given scheme. */
function Preview({ scheme }: { scheme: "light" | "dark" }) {
  const dark = scheme === "dark";
  return (
    <div
      aria-hidden
      className={cn(
        "flex h-full w-full flex-col gap-1.5 p-2.5",
        dark ? "bg-[oklch(0.155_0.006_265)]" : "bg-[oklch(0.972_0.005_85)]",
      )}
    >
      <div className={cn("h-1.5 w-8 rounded-full", dark ? "bg-white/70" : "bg-black/70")} />
      <div
        className={cn(
          "flex flex-1 flex-col gap-1 rounded-[4px] border p-1.5",
          dark ? "border-white/10 bg-[oklch(0.2_0.007_265)]" : "border-black/10 bg-white",
        )}
      >
        <div className={cn("h-1 w-3/4 rounded-full", dark ? "bg-white/40" : "bg-black/35")} />
        <div className={cn("h-1 w-1/2 rounded-full", dark ? "bg-white/20" : "bg-black/15")} />
        <div
          className={cn(
            "mt-auto h-2 w-6 rounded-[2px]",
            dark ? "bg-[oklch(0.6_0.19_264)]" : "bg-[oklch(0.46_0.22_264)]",
          )}
        />
      </div>
    </div>
  );
}

export function AppearanceSection({ userId }: { userId: string }) {
  const pref = useThemePref();
  const qc = useQueryClient();

  const choose = async (next: ThemePref) => {
    if (next === pref) return;
    const prev = pref;
    setThemePref(next); // instant, local
    const { error } = await supabase.from("profiles").update({ theme: next }).eq("id", userId);
    if (error) {
      setThemePref(prev);
      toast.error("Couldn't save your theme. Try again.");
      return;
    }
    qc.setQueryData(["profile-theme", userId], next);
  };

  return (
    <ProfileSection
      id="appearance"
      title="Appearance"
      description="Choose how Flowform looks for you. Saved to your account, so it follows you to other devices."
    >
      <div role="radiogroup" aria-label="Theme" className="grid gap-3 p-5 sm:grid-cols-3 md:p-6">
        {OPTIONS.map(({ value, label, hint, Icon }) => {
          const active = pref === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => choose(value)}
              className={cn(
                "group overflow-hidden rounded-lg border text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-brand/40",
                active ? "border-brand ring-1 ring-brand" : "border-hairline hover:border-ink/25",
              )}
            >
              <div className="flex h-20 border-b border-hairline">
                {value === "system" ? (
                  <>
                    <div className="w-1/2 overflow-hidden">
                      <Preview scheme="light" />
                    </div>
                    <div className="w-1/2 overflow-hidden">
                      <Preview scheme="dark" />
                    </div>
                  </>
                ) : (
                  <Preview scheme={value} />
                )}
              </div>
              <div className="flex items-start justify-between gap-2 px-3 py-2.5">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                    <Icon className="size-3.5 text-ink/60" />
                    {label}
                  </p>
                  <p className="mt-0.5 text-xs text-ink/50">{hint}</p>
                </div>
                <span
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                    active ? "border-brand bg-brand text-brand-foreground" : "border-ink/20",
                  )}
                >
                  {active && <Check className="size-2.5" strokeWidth={3.5} />}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </ProfileSection>
  );
}
