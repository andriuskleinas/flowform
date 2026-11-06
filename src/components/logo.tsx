/**
 * Flowform mark: an ink tile holding two "answer" bars — the one you just
 * filled in, and the shorter blue one that's next. One question at a time.
 */
export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <rect width="32" height="32" rx="7" fill="var(--ink)" />
      <rect x="8" y="10" width="16" height="4" rx="1.5" fill="var(--paper)" />
      <rect x="8" y="18" width="9" height="4" rx="1.5" fill="oklch(0.66 0.18 264)" />
    </svg>
  );
}

/** Mark + serif wordmark. `tone="light"` for use on ink backgrounds. */
export function Logo({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <span className="flex items-center gap-2.5">
      {tone === "light" ? (
        <svg viewBox="0 0 32 32" aria-hidden className="size-7">
          <rect width="32" height="32" rx="7" fill="var(--paper)" />
          <rect x="8" y="10" width="16" height="4" rx="1.5" fill="var(--ink)" />
          <rect x="8" y="18" width="9" height="4" rx="1.5" fill="var(--brand)" />
        </svg>
      ) : (
        <LogoMark />
      )}
      <span
        className={`font-display text-[1.6rem] leading-none ${
          tone === "light" ? "text-paper" : "text-ink"
        }`}
      >
        Flowform
      </span>
    </span>
  );
}
