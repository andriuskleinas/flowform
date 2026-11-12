import type { FormStatus } from "@/lib/form-utils";

/**
 * The one definition of how a form's status looks. Every list, card and
 * header uses these, so "Live" is the same green dot everywhere, in both
 * themes.
 */
export const STATUS_STYLE: Record<FormStatus, { label: string; dot: string; text: string }> = {
  published: { label: "Live", dot: "bg-mint", text: "text-mint" },
  closed: { label: "Closed", dot: "bg-sun", text: "text-sun" },
  draft: { label: "Draft", dot: "bg-ink/30", text: "text-ink/55" },
};

/** Dot + word, for dense places: list rows, cards, the command palette. */
export function StatusLabel({ status }: { status: FormStatus }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium ${s.text}`}>
      <span aria-hidden className={`size-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

/** Bordered chip, for page headers where the status stands alone. */
export function StatusPill({ status }: { status: FormStatus }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.draft;
  return (
    <span
      className={`inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full border border-hairline bg-card px-2 text-[11px] font-medium ${s.text}`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
