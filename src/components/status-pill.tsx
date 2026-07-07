import type { FormStatus } from "@/lib/form-utils";

export function StatusPill({ status }: { status: FormStatus }) {
  if (status === "published") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
        <span className="size-1.5 rounded-full bg-emerald-500" /> Published live
      </span>
    );
  }
  if (status === "closed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
        <span className="size-1.5 rounded-full bg-amber-500" /> Closed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/10 px-2.5 py-0.5 text-xs font-semibold text-ink/60">
      <span className="size-1.5 rounded-full bg-ink/40" /> Draft
    </span>
  );
}
