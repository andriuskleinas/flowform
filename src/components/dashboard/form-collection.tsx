import { Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  CircleSlash,
  CirclePlay,
  CopyPlus,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  Share2,
  Tag,
  Trash2,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusPill } from "@/components/status-pill";
import { CategoryTag } from "@/components/dashboard/category-dialog";
import { timeAgo } from "@/lib/utils";
import type { FormStatus } from "@/lib/form-utils";
import { completionRate, formatRate, type SortKey } from "@/lib/dashboard-filters";

export type DashboardForm = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  status: FormStatus;
  category_id: string | null;
  category: string | null;
  category_color: string | null;
  response_count: number;
  question_count: number;
  last_response_at: string | null;
  responses_7d: number;
  responses_90d: number;
  views_90d: number;
};

export type ViewMode = "list" | "grid" | "table";

export type FormActionHandlers = {
  onShare: (f: DashboardForm) => void;
  onDuplicate: (f: DashboardForm) => void;
  onSetStatus: (f: DashboardForm, status: FormStatus) => void;
  onCategory: (f: DashboardForm) => void;
  onDelete: (f: DashboardForm) => void;
  duplicatePending: boolean;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function FormCollection({
  forms,
  view,
  actions,
  sort,
  onSort,
}: {
  forms: DashboardForm[];
  view: ViewMode;
  actions: FormActionHandlers;
  /** Table view: current sort + handler, for clickable column headers. */
  sort?: SortKey;
  onSort?: (sort: SortKey) => void;
}) {
  if (view === "grid") {
    return (
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {forms.map((f) => (
          <GridCard key={f.id} form={f} actions={actions} />
        ))}
      </ul>
    );
  }
  if (view === "table") {
    return <FormTable forms={forms} actions={actions} sort={sort} onSort={onSort} />;
  }
  return (
    <ul className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-white">
      {forms.map((f) => (
        <ListRow key={f.id} form={f} actions={actions} />
      ))}
    </ul>
  );
}

/**
 * The form's category, always shown: a coloured tag (click to change), or a
 * faint "+ Category" button when it has none. Sits above the card's stretched
 * link (relative z-10) so it stays clickable without nesting in the anchor.
 */
function CategoryBadge({ form: f, actions }: { form: DashboardForm; actions: FormActionHandlers }) {
  if (f.category) {
    return (
      <button
        type="button"
        onClick={() => actions.onCategory(f)}
        title="Change category"
        aria-label={`Category: ${f.category}. Change category`}
        className="relative z-10 rounded-sm transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        <CategoryTag name={f.category} color={f.category_color} />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => actions.onCategory(f)}
      className="relative z-10 inline-flex items-center gap-1 rounded-sm border border-dashed border-ink/20 px-1.5 py-[1px] text-[11px] text-ink/40 transition-colors hover:border-ink/40 hover:text-ink/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
    >
      <Plus className="size-3" />
      Category
    </button>
  );
}

/** Makes the whole card clickable via the title link (no nested interactives). */
const stretchedLink = "after:absolute after:inset-0 after:content-[''] focus-visible:outline-none";

function ListRow({ form: f, actions }: { form: DashboardForm; actions: FormActionHandlers }) {
  return (
    <li className="group relative p-4 transition-colors focus-within:bg-paper hover:bg-paper">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface text-ink/50">
            <FileText className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-[15px] font-medium tracking-normal">
                <Link to="/forms/$formId/edit" params={{ formId: f.id }} className={stretchedLink}>
                  {f.title}
                </Link>
              </h3>
              <StatusPill status={f.status} />
              <CategoryBadge form={f} actions={actions} />
            </div>
            {f.description && (
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink/60">
                {f.description}
              </p>
            )}
            <p className="mt-1.5 font-mono text-[11px] text-ink/45">
              {plural(f.question_count, "question", "questions")} ·{" "}
              {plural(f.response_count, "response", "responses")}
              {f.responses_7d > 0 && (
                <span className="text-emerald-700"> · {f.responses_7d} this week</span>
              )}
              {completionRate(f) !== null && <> · {formatRate(completionRate(f))} completion</>} ·{" "}
              {timeAgo(f.created_at)}
            </p>
          </div>
        </div>
        <div className="relative z-10">
          <FormActions form={f} actions={actions} />
        </div>
      </div>
    </li>
  );
}

function GridCard({ form: f, actions }: { form: DashboardForm; actions: FormActionHandlers }) {
  return (
    <li className="group relative flex flex-col rounded-lg border border-hairline bg-white transition-colors focus-within:border-ink/30 hover:border-ink/20">
      <div className="flex flex-1 flex-col p-4 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={f.status} />
          <CategoryBadge form={f} actions={actions} />
        </div>
        <h3 className="mt-3 line-clamp-2 text-[15px] font-medium leading-snug tracking-normal">
          <Link to="/forms/$formId/edit" params={{ formId: f.id }} className={stretchedLink}>
            {f.title}
          </Link>
        </h3>
        <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-ink/55">
          {f.description || <span className="text-ink/30">No description</span>}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-md bg-surface px-2.5 py-2">
            <dt className="text-[11px] text-ink/50">Responses</dt>
            <dd className="text-lg font-medium tabular-nums">
              {f.response_count}
              {f.responses_7d > 0 && (
                <span className="ml-1.5 text-xs font-normal text-emerald-700">
                  +{f.responses_7d} wk
                </span>
              )}
            </dd>
          </div>
          <div className="rounded-md bg-surface px-2.5 py-2">
            <dt className="text-[11px] text-ink/50" title="Responses ÷ views, last 90 days">
              Completion
            </dt>
            <dd className="text-lg font-medium tabular-nums">{formatRate(completionRate(f))}</dd>
          </div>
        </dl>
      </div>
      <div className="flex items-center justify-between border-t border-hairline py-1 pl-4 pr-1">
        <span className="font-mono text-[11px] text-ink/45">
          {f.last_response_at
            ? `last reply ${timeAgo(f.last_response_at)}`
            : `created ${timeAgo(f.created_at)}`}
        </span>
        <div className="relative z-10">
          <FormActions form={f} actions={actions} compact />
        </div>
      </div>
    </li>
  );
}

/** Column → the sort it applies; clicking an active toggle column flips it. */
const COLUMN_SORTS: Record<string, { sorts: SortKey[]; label: string }> = {
  form: { sorts: ["title"], label: "Form" },
  responses: { sorts: ["most", "fewest"], label: "Responses" },
  week: { sorts: ["trending"], label: "7 days" },
  completion: { sorts: ["completion"], label: "Completion" },
  last: { sorts: ["recent"], label: "Last reply" },
  created: { sorts: ["newest", "oldest"], label: "Created" },
};

function SortHeader({
  column,
  sort,
  onSort,
  align = "left",
  className = "",
}: {
  column: keyof typeof COLUMN_SORTS;
  sort?: SortKey;
  onSort?: (s: SortKey) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const { sorts, label } = COLUMN_SORTS[column];
  const activeIdx = sort ? sorts.indexOf(sort) : -1;
  const active = activeIdx >= 0;
  const next = active ? sorts[(activeIdx + 1) % sorts.length] : sorts[0];
  // Arrow shows direction: "down" for big→small / new→old / A→Z.
  const descending =
    active && ["most", "trending", "completion", "recent", "newest", "title"].includes(sort!);
  const content = (
    <>
      {label}
      {active && (descending ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
    </>
  );
  return (
    <th
      className={`py-2.5 font-medium ${align === "right" ? "text-right" : ""} ${className}`}
      aria-sort={active ? (descending ? "descending" : "ascending") : undefined}
    >
      {onSort ? (
        <button
          type="button"
          onClick={() => onSort(next)}
          className={
            "inline-flex items-center gap-1 rounded hover:text-ink " +
            (active ? "text-ink" : "") +
            (align === "right" ? " flex-row-reverse" : "")
          }
        >
          {content}
        </button>
      ) : (
        content
      )}
    </th>
  );
}

function FormTable({
  forms,
  actions,
  sort,
  onSort,
}: {
  forms: DashboardForm[];
  actions: FormActionHandlers;
  sort?: SortKey;
  onSort?: (s: SortKey) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-hairline bg-white">
      <table className="w-full min-w-[860px] table-fixed text-sm">
        {/* Fixed column widths keep grouped tables aligned with each other. */}
        <colgroup>
          <col />
          <col className="w-[96px]" />
          <col className="w-[136px]" />
          <col className="w-[96px]" />
          <col className="w-[72px]" />
          <col className="w-[96px]" />
          <col className="w-[92px]" />
          <col className="w-[84px]" />
          <col className="w-[48px]" />
        </colgroup>
        <thead>
          <tr className="border-b border-hairline text-left text-xs text-ink/50">
            <SortHeader column="form" sort={sort} onSort={onSort} className="px-4" />
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 font-medium">Category</th>
            <SortHeader
              column="responses"
              sort={sort}
              onSort={onSort}
              align="right"
              className="px-3"
            />
            <SortHeader column="week" sort={sort} onSort={onSort} align="right" className="px-3" />
            <SortHeader
              column="completion"
              sort={sort}
              onSort={onSort}
              align="right"
              className="px-3"
            />
            <SortHeader column="last" sort={sort} onSort={onSort} className="px-3" />
            <SortHeader column="created" sort={sort} onSort={onSort} className="px-3" />
            <th className="w-10 px-2 py-2.5">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {forms.map((f) => (
            <tr key={f.id} className="transition-colors hover:bg-paper">
              <td className="px-4 py-2.5">
                <Link
                  to="/forms/$formId/edit"
                  params={{ formId: f.id }}
                  className="block truncate font-medium hover:text-brand"
                  title={f.title}
                >
                  {f.title}
                </Link>
              </td>
              <td className="px-3 py-2.5">
                <StatusPill status={f.status} />
              </td>
              <td className="px-3 py-2.5">
                <CategoryBadge form={f} actions={actions} />
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                {f.response_count}
              </td>
              <td
                className={
                  "px-3 py-2.5 text-right font-mono text-xs tabular-nums " +
                  (f.responses_7d > 0 ? "text-emerald-700" : "text-ink/40")
                }
              >
                {f.responses_7d > 0 ? `+${f.responses_7d}` : "0"}
              </td>
              <td
                className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-ink/70"
                title={
                  completionRate(f) === null
                    ? "Not enough views yet (last 90 days)"
                    : `${f.responses_90d} responses from ${f.views_90d} views, last 90 days`
                }
              >
                {formatRate(completionRate(f))}
              </td>
              <td className="px-3 py-2.5 font-mono text-xs text-ink/50">
                {f.last_response_at ? timeAgo(f.last_response_at) : "—"}
              </td>
              <td className="px-3 py-2.5 font-mono text-xs text-ink/50">{timeAgo(f.created_at)}</td>
              <td className="px-2 py-1.5">
                <FormActions form={f} actions={actions} menuOnly />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const iconBtn = "rounded-md p-2 text-ink/50 hover:bg-ink/5 hover:text-ink";

/**
 * Per-form actions. `compact` (grid) keeps share + responses inline;
 * `menuOnly` (table) folds everything into the overflow menu.
 */
function FormActions({
  form: f,
  actions,
  compact = false,
  menuOnly = false,
}: {
  form: DashboardForm;
  actions: FormActionHandlers;
  compact?: boolean;
  menuOnly?: boolean;
}) {
  const isDraft = f.status === "draft";
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {!menuOnly && !compact && (
        <Link
          to="/forms/$formId/edit"
          params={{ formId: f.id }}
          aria-label="Edit form"
          title="Edit"
          className={iconBtn}
        >
          <Pencil className="size-4" />
        </Link>
      )}
      {!menuOnly && (
        <>
          <button
            type="button"
            onClick={() => actions.onShare(f)}
            aria-label={isDraft ? "Publish and share" : "Share form"}
            title={isDraft ? "Publish and share" : "Share"}
            className={iconBtn}
          >
            <Share2 className="size-4" />
          </button>
          <Link
            to="/forms/$formId/responses"
            params={{ formId: f.id }}
            aria-label="View responses"
            title="View responses"
            className={iconBtn}
          >
            <BarChart3 className="size-4" />
          </Link>
        </>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="More actions"
          title="More actions"
          className={iconBtn + " outline-none focus-visible:ring-2 focus-visible:ring-brand/40"}
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {menuOnly && (
            <>
              <DropdownMenuItem asChild>
                <Link to="/forms/$formId/edit" params={{ formId: f.id }}>
                  <Pencil className="size-4" />
                  Edit form
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.onShare(f)}>
                <Share2 className="size-4" />
                {isDraft ? "Publish and share" : "Share"}
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/forms/$formId/responses" params={{ formId: f.id }}>
                  <BarChart3 className="size-4" />
                  View responses
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onClick={() => actions.onCategory(f)}>
            <Tag className="size-4" />
            {f.category_id ? "Change category" : "Set category"}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={actions.duplicatePending}
            onClick={() => actions.onDuplicate(f)}
          >
            <CopyPlus className="size-4" />
            Duplicate form
          </DropdownMenuItem>
          {f.status === "published" && (
            <DropdownMenuItem onClick={() => actions.onSetStatus(f, "closed")}>
              <CircleSlash className="size-4" />
              Close form
            </DropdownMenuItem>
          )}
          {f.status === "closed" && (
            <DropdownMenuItem onClick={() => actions.onSetStatus(f, "published")}>
              <CirclePlay className="size-4" />
              Reopen form
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => actions.onDelete(f)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="size-4" />
            Delete form
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
