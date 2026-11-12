import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ChevronRight } from "lucide-react";

import { SHELL_WIDTH, type ShellWidth } from "@/components/app-shell";
import { StatusPill } from "@/components/status-pill";
import type { FormStatus } from "@/lib/form-utils";
import { cn } from "@/lib/utils";

/**
 * Shared button styles for page-level actions, so "Save" in the editor and
 * "Export CSV" on the results page are the same size and weight.
 */
export const actionBtn =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-50";
export const actionSecondary = `${actionBtn} border border-hairline bg-card text-ink hover:border-ink/25`;
export const actionPrimary = `${actionBtn} bg-brand text-brand-foreground hover:bg-brand/90`;

export type FormTab = "build" | "results";

/**
 * The bar at the top of every page that belongs to one form.
 *
 * It says which form you're in and its status, and lays the form's life out
 * as tabs: Build it, read the Results, Present them live. The page's own
 * actions (Save, Publish, Export…) sit on the right and stay in reach while
 * the page scrolls.
 */
export function FormHeader({
  formId,
  title,
  status,
  version,
  ownerSearch,
  active,
  canEdit,
  responseCount,
  actions,
  width = "lg",
}: {
  formId: string;
  title: string;
  status?: FormStatus;
  /** Shown from v2 on: how many times the form was updated under one link. */
  version?: number;
  /** `{ ws }` when the form lives in someone else's workspace. */
  ownerSearch: { ws?: string };
  active: FormTab;
  /** Viewers can't build, so they don't get the tab. */
  canEdit: boolean;
  responseCount?: number | null;
  actions?: React.ReactNode;
  width?: ShellWidth;
}) {
  const tab = (isActive: boolean) =>
    cn(
      "inline-flex h-9 shrink-0 items-center gap-1.5 border-b-2 text-[13px] outline-none transition-colors focus-visible:text-ink",
      isActive
        ? "border-ink font-medium text-ink"
        : "border-transparent text-ink/55 hover:text-ink",
    );

  return (
    <div className="sticky top-14 z-20 border-b border-hairline bg-surface/90 backdrop-blur lg:top-0">
      <div className={cn("mx-auto w-full px-5 md:px-8", SHELL_WIDTH[width])}>
        <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-2.5">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px]">
            <Link
              to="/dashboard"
              search={ownerSearch}
              className="shrink-0 rounded text-ink/55 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              Forms
            </Link>
            <ChevronRight aria-hidden className="size-3.5 shrink-0 text-ink/30" />
            <span className="truncate font-medium text-ink" title={title}>
              {title}
            </span>
            {status && (
              <span className="ml-1.5 flex shrink-0 items-center gap-1.5">
                <StatusPill status={status} />
                {version != null && version > 1 && (
                  <span
                    title={`Updated ${version - 1} ${version === 2 ? "time" : "times"} under the same link`}
                    className="inline-flex h-5 items-center rounded-full border border-hairline px-1.5 font-mono text-[11px] text-ink/55"
                  >
                    v{version}
                  </span>
                )}
              </span>
            )}
          </nav>
          {actions && (
            <div className="flex flex-wrap items-center justify-end gap-1.5">{actions}</div>
          )}
        </div>

        <nav aria-label="Form sections" className="-mb-px mt-1 flex gap-5 overflow-x-auto">
          {canEdit && (
            <Link
              to="/forms/$formId/edit"
              params={{ formId }}
              aria-current={active === "build" ? "page" : undefined}
              className={tab(active === "build")}
            >
              Build
            </Link>
          )}
          <Link
            to="/forms/$formId/responses"
            params={{ formId }}
            aria-current={active === "results" ? "page" : undefined}
            className={tab(active === "results")}
          >
            Results
            {responseCount != null && responseCount > 0 && (
              <span
                className={cn(
                  "rounded px-1 font-mono text-[10px] tabular-nums",
                  active === "results" ? "bg-ink/[0.07] text-ink/70" : "text-ink/40",
                )}
              >
                {responseCount}
              </span>
            )}
          </Link>
          <Link
            to="/forms/$formId/live"
            params={{ formId }}
            title="Full-screen results that update as answers arrive. Made for talks and workshops."
            className={tab(false)}
          >
            Present
            <ArrowUpRight aria-hidden className="size-3.5 text-ink/40" />
          </Link>
        </nav>
      </div>
    </div>
  );
}
