import { useEffect, useSyncExternalStore } from "react";

/**
 * Colour theme: the user's preference ("light" / "dark" / "system") lives in
 * localStorage for an instant, flash-free first paint, and in
 * `profiles.theme` so it follows the account across devices (see ThemeSync).
 *
 * The preference belongs to the account, so it only applies while someone is
 * logged in. Logged out, every page is light, whatever was saved.
 */
export type ThemePref = "light" | "dark" | "system";
export const THEME_PREFS: ThemePref[] = ["light", "dark", "system"];

const KEY = "flowform:theme";
const EVENT = "flowform:theme-change";

export function isThemePref(v: unknown): v is ThemePref {
  return v === "light" || v === "dark" || v === "system";
}

/**
 * Runs in <head> before first paint so a dark-mode user never sees a white
 * flash. Must stay dependency-free and mirror `resolveDark` below. A stored
 * Supabase session (`sb-<ref>-auth-token`) stands in for "logged in": without
 * one, the saved preference is ignored and the page stays light.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var s=false;for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&/^sb-.+-auth-token$/.test(k)){s=true;break}}if(!s)return;var p=localStorage.getItem('${KEY}');var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})();`;

/**
 * Whether the saved preference applies right now (someone is logged in).
 * `null` until auth has resolved: then nothing is changed, so the first-paint
 * choice of THEME_INIT_SCRIPT stands and the page doesn't flicker.
 */
let active: boolean | null = null;

function systemDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveDark(pref: ThemePref) {
  return pref === "dark" || (pref === "system" && systemDark());
}

export function readThemePref(): ThemePref {
  try {
    const v = window.localStorage.getItem(KEY);
    return isThemePref(v) ? v : "light";
  } catch {
    return "light";
  }
}

/** The preference as it applies: "light" for anyone logged out. */
function effective(pref: ThemePref): ThemePref {
  return active === false ? "light" : pref;
}

function applyTheme(pref: ThemePref) {
  if (active === null) return;
  document.documentElement.classList.toggle("dark", resolveDark(effective(pref)));
}

/** Called by ThemeSync whenever the session appears or goes away. */
export function setThemeActive(signedIn: boolean) {
  if (active === signedIn) return;
  active = signedIn;
  applyTheme(readThemePref());
  window.dispatchEvent(new Event(EVENT));
}

/** Local-only: store + apply. Persisting to the profile is the caller's job. */
export function setThemePref(pref: ThemePref) {
  try {
    window.localStorage.setItem(KEY, pref);
  } catch {
    // Storage blocked — the theme still applies for this page view.
  }
  applyTheme(pref);
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** The saved preference (what the settings show), whether or not it applies. */
export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribe, readThemePref, () => "light");
}

/** The theme pages actually use: the saved one when logged in, else light. */
export function useActiveThemePref(): ThemePref {
  return useSyncExternalStore(
    subscribe,
    () => effective(readThemePref()),
    () => "light",
  );
}

function subscribeSystem(cb: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** Whether the device is currently in dark mode (live). */
export function useSystemDark(): boolean {
  return useSyncExternalStore(subscribeSystem, systemDark, () => false);
}

/** Keeps "system" live when the OS flips, and syncs other tabs. Mount once. */
export function useThemeEffects() {
  const pref = useActiveThemePref();
  useEffect(() => {
    applyTheme(pref);
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);
}
