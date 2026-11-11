import { Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  CircleSlash,
  CirclePlay,
  CopyPlus,
  MoreHorizontal,
  Pencil,
  Send,
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

export type ViewMode = "list" | "grid";

export type FormActionHandlers = {
  /** Role gates (see lib/workspace): editors+ change forms, admins+ delete. */
  canEdit: boolean;
  canDelete: boolean;
  onShare: (f: DashboardForm) => void;
  onDuplicate: (f: DashboardForm) => void;
  onSetStatus: (f: DashboardForm, status: FormStatus) => void;
  onCategory: (f: DashboardForm) => void;
  onDelete: (f: DashboardForm) => void;
  duplicatePending: boolean;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const fmt = new Intl.NumberFormat("en");

/** Makes the whole row/card clickable via the title link (no nested interactives). */
const stretchedLink =
  "after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-[inherit] focus-visible:after:ring-2 focus-visible:after:ring-brand/40";

/** Editors open the builder; viewers can't edit, so the title takes them to results. */
const titleHref = (a: FormActionHandlers) =>
  a.canEdit ? ("/forms/$formId/edit" as const) : ("/forms/$formId/responses" as const);

/** Shared column template so the header and every row line up. */
const COLS = "md:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem_7.5rem_10rem]";

export function FormsView({
  forms,
  view,
  actions,
  sort,
  onSort,
  showHeader = true,
}: {
  forms: DashboardForm[];
  view: ViewMode;
  actions: FormActionHandlers;
  sort: SortKey;
  onSort: (sort: SortKey) => void;
  /** List view: hide the column header (e.g. on every group after the first). */
  showHeader?: boolean;
}) {
  if (view === "grid") {
    return (
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {forms.map((f) => (
          <GridCard key={f.id} form={f} actions={actions} />
        ))}
      </ul>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-card">
      {showHeader && (
        <div
          className={`hidden items-center gap-x-4 border-b border-hairline px-4 py-2 text-[11px] text-ink/50 md:grid ${COLS}`}
        >
          <SortHeader label="Form" sorts={["title"]} sort={sort} onSort={onSort} />
          <SortHeader
            label="Responses"
            sorts={["most", "fewest"]}
            sort={sort}
            onSort={onSort}
            align="right"
          />
          <SortHeader
            label="Conversion"
            sorts={["completion"]}
            sort={sort}
            onSort={onSort}
            align="right"
            title="Responses ÷ views, last 90 days"
          />
          <SortHeader label="Last response" sorts={["recent"]} sort={sort} onSort={onSort} />
          <span className="sr-only">Actions</span>
        </div>
      )}
      <ul className="divide-y divide-hairline">
        {forms.map((f) => (
          <ListRow key={f.id} form={f} actions={actions} />
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------- Pieces ---------------------------------- */

const STATUS: Record<FormStatus, { label: string; dot: string; text: string }> = {
  published: { label: "Live", dot: "bg-mint", text: "text-mint" },
  closed: { label: "Closed", dot: "bg-sun", text: "text-sun" },
  draft: { label: "Draft", dot: "bg-ink/30", text: "text-ink/55" },
};

function StatusLabel({ status }: { status: FormStatus }) {
  const s = STATUS[status] ?? STATUS.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium ${s.text}`}>
      <span aria-hidden className={`size-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function CategoryButton({
  form: f,
  actions,
}: {
  form: DashboardForm;
  actions: FormActionHandlers;
}) {
  if (!f.category) return null;
  if (!actions.canEdit) return <CategoryTag name={f.category} color={f.category_color} />;
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

function ResponsesLink({ form: f, className = "" }: { form: DashboardForm; className?: string }) {
  return (
    <Link
      to="/forms/$formId/responses"
      params={{ formId: f.id }}
      title="View results"
      className={`relative z-10 rounded-sm tabular-nums outline-none hover:text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand/40 ${className}`}
    >
      {fmt.format(f.response_count)}
    </Link>
  );
}

function ListRow({ form: f, actions }: { form: DashboardForm; actions: FormActionHandlers }) {
  const rate = completionRate(f);
  return (
    <li
      className={`group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-3.5 transition-colors hover:bg-surface ${COLS}`}
    >
      <div className="min-w-0">
        <h3 className="truncate text-sm font-medium">
          <Link to={titleHref(actions)} params={{ formId: f.id }} className={stretchedLink}>
            {f.title}
          </Link>
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink/50">
          <StatusLabel status={f.status} />
          <CategoryButton form={f} actions={actions} />
          <span>{plural(f.question_count, "question")}</span>
          {/* Metrics collapse into the meta line on small screens. */}
          <span className="md:hidden">{plural(f.response_count, "response")}</span>
          {rate !== null && <span className="md:hidden">{formatRate(rate)} conversion</span>}
        </div>
      </div>

      <div className="hidden text-right text-sm md:block">
        <ResponsesLink form={f} />
        <div className="h-4 font-mono text-[11px] text-mint">
          {f.responses_7d > 0 ? `+${f.responses_7d} this wk` : ""}
        </div>
      </div>

      <div
        className="hidden text-right text-sm tabular-nums md:block"
        title={
          rate === null
            ? "Not enough views yet (last 90 days)"
            : `${f.responses_90d} responses from ${f.views_90d} views, last 90 days`
        }
      >
        <span className={rate === null ? "text-ink/30" : ""}>{formatRate(rate)}</span>
        <div className="h-4 font-mono text-[11px] text-ink/40">
          {rate !== null ? `${fmt.format(f.views_90d)} views` : ""}
        </div>
      </div>

      <div className="hidden text-xs text-ink/55 md:block">
        {f.last_response_at ? (
          timeAgo(f.last_response_at)
        ) : (
          <span className="text-ink/30">No responses</span>
        )}
        <div className="font-mono text-[11px] text-ink/35">created {timeAgo(f.created_at)}</div>
      </div>

      <div className="relative z-10 flex items-center justify-end gap-1">
        <PrimaryAction form={f} actions={actions} />
        <FormMenu form={f} actions={actions} />
      </div>
    </li>
  );
}

function GridCard({ form: f, actions }: { form: DashboardForm; actions: FormActionHandlers }) {
  const rate = completionRate(f);
  return (
    <li className="group relative flex min-w-0 flex-col rounded-xl border border-hairline bg-card transition-colors focus-within:border-ink/30 hover:border-ink/25">
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2 text-xs">
          <StatusLabel status={f.status} />
          <CategoryButton form={f} actions={actions} />
        </div>
        <h3 className="mt-2.5 line-clamp-2 text-[15px] font-medium leading-snug">
          <Link to={titleHref(actions)} params={{ formId: f.id }} className={stretchedLink}>
            {f.title}
          </Link>
        </h3>
        {f.description && (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink/55">{f.description}</p>
        )}
        <dl className="mt-auto grid grid-cols-3 gap-3 pt-5">
          <div>
            <dt className="text-[11px] text-ink/45">Responses</dt>
            <dd className="mt-0.5 text-lg font-medium">
              <ResponsesLink form={f} />
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink/45">This week</dt>
            <dd
              className={
                "mt-0.5 text-lg font-medium tabular-nums " +
                (f.responses_7d > 0 ? "text-mint" : "text-ink/30")
              }
            >
              {f.responses_7d > 0 ? `+${f.responses_7d}` : "0"}
            </dd>
          </div>
          <div title="Responses ÷ views, last 90 days">
            <dt className="text-[11px] text-ink/45">Conversion</dt>
            <dd
              className={
                "mt-0.5 text-lg font-medium tabular-nums " + (rate === null ? "text-ink/30" : "")
              }
            >
              {formatRate(rate)}
            </dd>
          </div>
        </dl>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-hairline py-2 pl-4 pr-2">
        <span className="truncate text-xs text-ink/45">
          {f.last_response_at
            ? `Last response ${timeAgo(f.last_response_at)}`
            : `${plural(f.question_count, "question")} · created ${timeAgo(f.created_at)}`}
        </span>
        <div className="relative z-10 flex shrink-0 items-center gap-1">
          <PrimaryAction form={f} actions={actions} />
          <FormMenu form={f} actions={actions} />
        </div>
      </div>
    </li>
  );
}

function SortHeader({
  label,
  sorts,
  sort,
  onSort,
  align = "left",
  title,
}: {
  label: string;
  sorts: SortKey[];
  sort: SortKey;
  onSort: (s: SortKey) => void;
  align?: "left" | "right";
  title?: string;
}) {
  const idx = sorts.indexOf(sort);
  const active = idx >= 0;
  const next = active ? sorts[(idx + 1) % sorts.length] : sorts[0];
  const ascending = sort === "fewest" || (sort === "title" && active);
  // When a single-sort column is clicked again, fall back to the default.
  const target = active && sorts.length === 1 ? "newest" : next;
  return (
    <button
      type="button"
      onClick={() => onSort(target)}
      title={title}
      aria-sort={active ? (ascending ? "ascending" : "descending") : undefined}
      className={
        "inline-flex items-center gap-1 rounded font-medium outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/40 " +
        (active ? "text-ink " : "") +
        (align === "right" ? "justify-self-end" : "justify-self-start")
      }
    >
      {label}
      {active && (ascending ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
    </button>
  );
}

const ghostBtn =
  "inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-hairline bg-card px-2.5 text-xs font-medium text-ink/75 outline-none transition-colors hover:border-ink/25 hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/40";

/** The one thing you most likely want to do with this form right now. */
function PrimaryAction({ form: f, actions }: { form: DashboardForm; actions: FormActionHandlers }) {
  if (f.status === "draft") {
    // Viewers can't publish; a draft has nothing for them to act on.
    if (!actions.canEdit) return null;
    if (f.question_count === 0) {
      return (
        <Link to="/forms/$formId/edit" params={{ formId: f.id }} className={ghostBtn}>
          <Pencil className="size-3.5" /> Add questions
        </Link>
      );
    }
    return (
      <button type="button" onClick={() => actions.onShare(f)} className={ghostBtn}>
        <Send className="size-3.5" /> Publish
      </button>
    );
  }
  if (f.status === "published") {
    return (
      <button type="button" onClick={() => actions.onShare(f)} className={ghostBtn}>
        <Share2 className="size-3.5" /> Share
      </button>
    );
  }
  return (
    <Link to="/forms/$formId/responses" params={{ formId: f.id }} className={ghostBtn}>
      <BarChart3 className="size-3.5" /> Results
    </Link>
  );
}

function FormMenu({ form: f, actions }: { form: DashboardForm; actions: FormActionHandlers }) {
  const isDraft = f.status === "draft";
  // Viewers can share a link that's already live, but not publish a draft.
  const canShare = f.status === "published" || (isDraft && actions.canEdit);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`More actions for ${f.title}`}
        className="rounded-md p-1.5 text-ink/45 outline-none transition-colors hover:bg-ink/5 hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/40 data-[state=open]:bg-ink/5 data-[state=open]:text-ink"
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {actions.canEdit && (
          <DropdownMenuItem asChild>
            <Link to="/forms/$formId/edit" params={{ formId: f.id }}>
              <Pencil className="size-4" />
              {isDraft ? "Edit form" : "Open form"}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link to="/forms/$formId/responses" params={{ formId: f.id }}>
            <BarChart3 className="size-4" />
            View results
          </Link>
        </DropdownMenuItem>
        {canShare && (
          <DropdownMenuItem onClick={() => actions.onShare(f)}>
            <Share2 className="size-4" />
            {isDraft ? "Publish and share" : "Share link"}
          </DropdownMenuItem>
        )}
        {actions.canEdit && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => actions.onCategory(f)}>
              <Tag className="size-4" />
              {f.category_id ? "Change category" : "Set category"}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={actions.duplicatePending}
              onClick={() => actions.onDuplicate(f)}
            >
              <CopyPlus className="size-4" />
              Duplicate
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
          </>
        )}
        {actions.canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => actions.onDelete(f)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
