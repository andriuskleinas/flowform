export function StatusPill({ status }: { status: "draft" | "published" }) {
  if (status === "published") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
        <span className="size-1.5 rounded-full bg-emerald-500" /> Published live
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/10 px-2.5 py-0.5 text-xs font-semibold text-ink/60">
      <span className="size-1.5 rounded-full bg-ink/40" /> Draft
    </span>
  );
}
