/**
 * Demo workspace on/off.
 *
 * The demo runs entirely in the browser: a flag in sessionStorage switches the
 * Supabase client to an in-memory workspace (see ./server.ts), so visitors can
 * click through the signed-in app without an account. Nothing reaches the
 * database, and the demo ends when the tab closes.
 */

const FLAG = "flowform:demo";
export const DEMO_STATE_KEY = "flowform:demo-state";

export function isDemo(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

/** Turn the demo on and load the dashboard fresh, so every client picks it up. */
export function enterDemo(to = "/dashboard") {
  try {
    window.sessionStorage.setItem(FLAG, "1");
  } catch {
    // Private mode without storage: the demo can't start, so stay put.
    return;
  }
  window.location.assign(to);
}

/** Turn the demo off, forget its changes and go back to the landing page. */
export function exitDemo(to = "/") {
  try {
    window.sessionStorage.removeItem(FLAG);
    window.sessionStorage.removeItem(DEMO_STATE_KEY);
  } catch {
    // Nothing to clean up.
  }
  window.location.assign(to);
}
