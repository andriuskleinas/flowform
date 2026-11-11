import { useEffect, useSyncExternalStore } from "react";

/**
 * Colour theme: the user's preference ("light" / "dark" / "system") lives in
 * localStorage for an instant, flash-free first paint, and in
 * `profiles.theme` so it follows the account across devices (see ThemeSync).
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
 * flash. Must stay dependency-free and mirror `resolveDark` below.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem('${KEY}');var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})();`;

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

function applyTheme(pref: ThemePref) {
  document.documentElement.classList.toggle("dark", resolveDark(pref));
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

export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribe, readThemePref, () => "light");
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
  const pref = useThemePref();
  useEffect(() => {
    applyTheme(pref);
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);
}
