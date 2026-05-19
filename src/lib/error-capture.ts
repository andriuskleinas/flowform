// Two responsibilities in this module:
//
// 1. Capture the original Error out-of-band so server.ts can recover the stack
//    when h3 has already swallowed the throw into a generic 500 Response.
// 2. Provide a pluggable `reportError` indirection so we can drop in Sentry
//    (or any other reporter) later without touching call sites. Default
//    implementation logs to console — install a real reporter at app boot
//    by calling `setErrorReporter(...)`.

let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5_000;

function record(error: unknown) {
  lastCapturedError = { error, at: Date.now() };
}

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => {
    const err = (event as ErrorEvent).error ?? event;
    record(err);
    reportError(err, { source: "window.error" });
  });
  globalThis.addEventListener("unhandledrejection", (event) => {
    const reason = (event as PromiseRejectionEvent).reason;
    record(reason);
    reportError(reason, { source: "unhandledrejection" });
  });
}

export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  if (Date.now() - lastCapturedError.at > TTL_MS) {
    lastCapturedError = undefined;
    return undefined;
  }
  const { error } = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}

/* -------------------------------------------------------------------------- */
/*                         Pluggable error reporter                            */
/* -------------------------------------------------------------------------- */

export type ErrorReporter = (error: unknown, context?: Record<string, unknown>) => void;

const defaultReporter: ErrorReporter = (error, context) => {
  // Keep this minimal — the goal is to be Sentry-ready, not to ship a Sentry.
  // When a reporter is configured (e.g. Sentry.captureException) it should
  // replace this entirely via setErrorReporter().
  if (context && Object.keys(context).length > 0) {
    console.error("[error]", error, context);
  } else {
    console.error("[error]", error);
  }
};

let activeReporter: ErrorReporter = defaultReporter;

/**
 * Swap in a different error reporter (e.g. Sentry.captureException).
 *
 * Example wiring at app boot:
 *   import * as Sentry from "@sentry/react";
 *   Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN });
 *   setErrorReporter((err, ctx) => Sentry.captureException(err, { extra: ctx }));
 */
export function setErrorReporter(reporter: ErrorReporter): void {
  activeReporter = reporter;
}

/**
 * Report an error through the active reporter. Never throws — a failing
 * reporter must not take down the surrounding request.
 */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  try {
    activeReporter(error, context);
  } catch (reporterErr) {
    // Last-resort: don't lose the original.
    console.error("[error-reporter-failed]", reporterErr);
    console.error("[error]", error, context);
  }
}
