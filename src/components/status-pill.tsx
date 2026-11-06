import type { FormStatus } from "@/lib/form-utils";

const STYLES: Record<FormStatus, { label: string; dot: string; text: string }> = {
  published: { label: "Live", dot: "bg-emerald-500", text: "text-emerald-800" },
  closed: { label: "Closed", dot: "bg-amber-500", text: "text-amber-800" },
  draft: { label: "Draft", dot: "bg-ink/30", text: "text-ink/60" },
};

export function StatusPill({ status }: { status: FormStatus }) {
  const s = STYLES[status] ?? STYLES.draft;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm border border-hairline bg-white px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide ${s.text}`}
    >
      <span className={`size-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
