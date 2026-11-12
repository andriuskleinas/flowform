import { GitBranch } from "lucide-react";

import { diffQuestions, versionCompletion, type FormVersion } from "@/lib/form-versions";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fmtDuration(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s ? `${m}m ${s}s` : `${m}m`;
}

/** Signed difference vs. the previous version, coloured by direction. */
function Delta({
  value,
  unit = "",
  invert = false,
}: {
  value: number | null;
  unit?: string;
  invert?: boolean;
}) {
  if (value == null || value === 0) return null;
  const good = invert ? value < 0 : value > 0;
  return (
    <span
      className={
        "ml-1.5 font-mono text-[11px] " +
        (good ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")
      }
    >
      {value > 0 ? "+" : "−"}
      {Math.abs(value)}
      {unit}
    </span>
  );
}

/**
 * Side-by-side metrics for every version of a form, newest first, with the
 * change from the previous version — the "did v2 actually help?" view.
 */
export function VersionComparison({
  versions,
  selected,
  onSelect,
}: {
  versions: FormVersion[];
  selected: number | null;
  onSelect: (v: number | null) => void;
}) {
  // versions arrive newest first; previous = the next entry in the array.
  const rows = versions.map((v, i) => {
    const prev = versions[i + 1];
    const completion = versionCompletion(v);
    const prevCompletion = prev ? versionCompletion(prev) : null;
    return {
      v,
      completion,
      completionDelta:
        completion != null && prevCompletion != null ? completion - prevCompletion : null,
      fillDelta:
        v.avg_fill_seconds != null && prev?.avg_fill_seconds != null
          ? Math.round(v.avg_fill_seconds - prev.avg_fill_seconds)
          : null,
      diff: prev ? diffQuestions(prev.questions, v.questions) : null,
    };
  });

  return (
    <div className="rounded-lg border border-hairline bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
            <GitBranch className="size-4 text-brand" /> Versions
          </h3>
          <p className="mt-0.5 text-xs text-ink/55">
            Each version keeps its own responses. Pick one to scope every chart below.
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left font-mono text-[10px] uppercase tracking-wide text-ink/45">
              <th className="px-5 py-2.5 font-medium">Version</th>
              <th className="px-3 py-2.5 font-medium">Live</th>
              <th className="px-3 py-2.5 text-right font-medium">Responses</th>
              <th className="px-3 py-2.5 text-right font-medium">Completion</th>
              <th className="px-3 py-2.5 text-right font-medium">Avg fill</th>
              <th className="px-5 py-2.5 font-medium">Changes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ v, completion, completionDelta, fillDelta, diff }) => {
              const active = selected === v.version;
              return (
                <tr
                  key={v.version}
                  onClick={() => onSelect(active ? null : v.version)}
                  aria-selected={active}
                  className={
                    "cursor-pointer border-t border-hairline transition-colors " +
                    (active ? "bg-accent" : "hover:bg-ink/[0.03]")
                  }
                >
                  <td className="px-5 py-3">
                    <span className="font-mono font-medium text-ink">v{v.version}</span>
                    {v.is_current && (
                      <span className="ml-2 rounded-sm border border-brand/25 bg-accent px-1.5 py-px font-mono text-[10px] uppercase tracking-wide text-brand">
                        Current
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-ink/60">
                    {fmtDate(v.started_at)} – {v.ended_at ? fmtDate(v.ended_at) : "now"}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-ink">
                    {v.responses}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums text-ink">
                    {completion != null ? `${completion}%` : "—"}
                    <Delta value={completionDelta} unit="pt" />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums text-ink">
                    {v.avg_fill_seconds != null ? fmtDuration(v.avg_fill_seconds) : "—"}
                    <Delta value={fillDelta} unit="s" invert />
                  </td>
                  <td className="px-5 py-3 text-xs text-ink/60">
                    {diff == null
                      ? `${v.questions.length} questions`
                      : diff.added + diff.removed + diff.changed === 0
                        ? "No question changes"
                        : [
                            diff.added && `+${diff.added} added`,
                            diff.removed && `−${diff.removed} removed`,
                            diff.changed && `${diff.changed} edited`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
