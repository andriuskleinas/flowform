import { Link } from "@tanstack/react-router";
import { useState, type DragEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  CircleSlash,
  CirclePlay,
  CopyPlus,
  MoreHorizontal,
  Pencil,
  Presentation,
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
import { StatusLabel } from "@/components/status-pill";
import type { DashboardForm } from "@/lib/dashboard-forms";
import { timeAgo } from "@/lib/utils";
import type { FormStatus } from "@/lib/form-utils";
import { DEFAULT_SORT, completionRate, formatRate, type SortKey } from "@/lib/dashboard-filters";

export type { DashboardForm };

export type ViewMode = "list" | "grid" | "board";

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
const COLS =
  "md:grid-cols-[minmax(0,1fr)_6rem_6rem_10rem] xl:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem_7.5rem_10rem]";

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
  if (view === "board") {
    return <BoardView forms={forms} actions={actions} />;
  }
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
          {/* Narrower screens drop this column so titles keep their room. */}
          <div className="hidden xl:block">
            <SortHeader label="Last response" sorts={["recent"]} sort={sort} onSort={onSort} />
          </div>
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

/* -------------------------------- Board ---------------------------------- */

const BOARD_COLUMNS: { status: FormStatus; label: string; empty: string }[] = [
  { status: "draft", label: "Draft", empty: "No drafts" },
  { status: "published", label: "Live", empty: "Nothing live right now" },
  { status: "closed", label: "Closed", empty: "No closed forms" },
];

/**
 * Lifecycle moves a drag may make. Live forms are locked against edits, so
 * nothing goes back to draft; a draft goes live through the publish flow.
 */
function canMove(from: FormStatus, to: FormStatus) {
  if (from === to) return false;
  if (to === "draft") return false;
  if (from === "draft") return to === "published";
  return true; // published <-> closed
}

const DRAG_TYPE = "application/x-flowform-form";

function BoardView({ forms, actions }: { forms: DashboardForm[]; actions: FormActionHandlers }) {
  const [dragging, setDragging] = useState<DashboardForm | null>(null);
  const [over, setOver] = useState<FormStatus | null>(null);

  const drop = (to: FormStatus) => {
    const f = dragging;
    setDragging(null);
    setOver(null);
    if (!f || !canMove(f.status, to)) return;
    if (f.status === "draft") {
      // Empty drafts can't be published; the publish flow handles the rest.
      if (f.question_count > 0) actions.onShare(f);
      return;
    }
    actions.onSetStatus(f, to);
  };

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="grid min-w-[46rem] grid-cols-3 gap-3">
        {BOARD_COLUMNS.map((col) => {
          const items = forms.filter((f) => f.status === col.status);
          const droppable =
            dragging !== null &&
            canMove(dragging.status, col.status) &&
            !(dragging.status === "draft" && dragging.question_count === 0);
          const onDragOver = (e: DragEvent) => {
            if (!droppable) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (over !== col.status) setOver(col.status);
          };
          return (
            <section
              key={col.status}
              aria-label={`${col.label} forms`}
              onDragOver={onDragOver}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                drop(col.status);
              }}
              className={
                "flex min-h-[16rem] flex-col rounded-xl border bg-surface/60 p-2 transition-colors " +
                (over === col.status
                  ? "border-brand/50 bg-brand/[0.05]"
                  : droppable
                    ? "border-dashed border-ink/25"
                    : "border-hairline")
              }
            >
              <header className="flex items-center justify-between px-2 pb-2.5 pt-1.5">
                <span className="text-xs">
                  <StatusLabel status={col.status} />
                </span>
                <span className="font-mono text-[11px] tabular-nums text-ink/40">
                  {items.length}
                </span>
              </header>
              <ul className="flex flex-1 flex-col gap-2">
                {items.map((f) => (
                  <BoardCard
                    key={f.id}
                    form={f}
                    actions={actions}
                    dragging={dragging?.id === f.id}
                    onDragStart={() => setDragging(f)}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                  />
                ))}
                {items.length === 0 && (
                  <li className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-hairline px-3 py-8 text-center text-xs text-ink/40">
                    {droppable
                      ? `Drop to ${col.status === "published" ? "publish" : "close"}`
                      : col.empty}
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function BoardCard({
  form: f,
  actions,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  form: DashboardForm;
  actions: FormActionHandlers;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const rate = completionRate(f);
  const draggable = actions.canEdit;
  return (
    <li
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData(DRAG_TYPE, f.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={
        "group relative rounded-lg border border-hairline bg-card px-3.5 py-3 transition-[border-color,box-shadow,opacity] focus-within:border-ink/30 hover:border-ink/20 hover:shadow-[0_1px_2px_rgb(0_0_0/0.04),0_4px_12px_-4px_rgb(0_0_0/0.08)] " +
        (draggable ? "cursor-grab active:cursor-grabbing " : "") +
        (dragging ? "opacity-40" : "")
      }
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 min-w-0 text-sm font-medium leading-snug tracking-normal">
          <Link
            to={titleHref(actions)}
            params={{ formId: f.id }}
            draggable={false}
            className={stretchedLink}
          >
            {f.title}
          </Link>
        </h3>
        <div className="relative z-10 -mr-1.5 -mt-1 shrink-0">
          <FormMenu form={f} actions={actions} />
        </div>
      </div>
      {f.category && (
        <div className="mt-1.5 text-xs">
          <CategoryButton form={f} actions={actions} />
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-2 font-mono text-[11px] text-ink/45">
        <span className="truncate">
          {f.response_count > 0 ? (
            <>
              <ResponsesLink form={f} className="text-ink/70" />{" "}
              {f.response_count === 1 ? "response" : "responses"}
              {rate !== null && ` · ${formatRate(rate)}`}
            </>
          ) : (
            plural(f.question_count, "question")
          )}
        </span>
        {f.responses_7d > 0 ? (
          <span className="shrink-0 text-mint">+{f.responses_7d} wk</span>
        ) : (
          <span className="shrink-0">{timeAgo(f.updated_at)}</span>
        )}
      </div>
    </li>
  );
}

/* ------------------------------- Pieces ---------------------------------- */

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
        <h3 className="truncate text-sm font-medium tracking-normal">
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

      <div className="hidden text-xs text-ink/55 xl:block">
        {f.last_response_at ? (
          timeAgo(f.last_response_at)
        ) : (
          <span className="text-ink/30">No responses</span>
        )}
        <div className="font-mono text-[11px] text-ink/35">updated {timeAgo(f.updated_at)}</div>
      </div>

      <div className="relative z-10 flex items-center justify-end gap-1">
        <PrimaryAction form={f} actions={actions} />
        <FormMenu form={f} actions={actions} />
      </div>
    </li>
  );
}

function GridCard({ form: f, actions }: { form: DashboardForm; actions: FormActionHandlers }) {
  const hasResponses = f.response_count > 0;
  return (
    <li className="group relative flex min-w-0 flex-col rounded-xl border border-hairline bg-card transition-[border-color,box-shadow] focus-within:border-ink/30 hover:border-ink/20 hover:shadow-[0_1px_2px_rgb(0_0_0/0.04),0_4px_16px_-4px_rgb(0_0_0/0.08)]">
      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
        <div className="flex h-7 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5 text-xs">
            <StatusLabel status={f.status} />
            <CategoryButton form={f} actions={actions} />
          </div>
          <div className="relative z-10 -mr-1.5 shrink-0">
            <FormMenu form={f} actions={actions} />
          </div>
        </div>

        <h3 className="mt-1.5 line-clamp-2 text-[15px] font-medium leading-snug tracking-normal">
          <Link to={titleHref(actions)} params={{ formId: f.id }} className={stretchedLink}>
            {f.title}
          </Link>
        </h3>
        {f.description && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink/55">
            {f.description}
          </p>
        )}

        {/* Body sits at the bottom so metrics line up across a row. */}
        <div className="mt-auto pt-4">
          {hasResponses ? <CardMetrics form={f} /> : <CardWaiting form={f} />}
        </div>
      </div>

      <div className="flex h-11 items-center justify-between gap-3 border-t border-hairline pl-4 pr-2.5">
        <span className="truncate text-xs text-ink/45">
          {f.last_response_at
            ? `Last response ${timeAgo(f.last_response_at)}`
            : `Updated ${timeAgo(f.updated_at)}`}
        </span>
        <div className="relative z-10 shrink-0">
          <PrimaryAction form={f} actions={actions} />
        </div>
      </div>
    </li>
  );
}

/** Forms with responses: the count, this week's movement, and conversion. */
function CardMetrics({ form: f }: { form: DashboardForm }) {
  const rate = completionRate(f);
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-medium leading-none tracking-tight">
            <ResponsesLink form={f} />
          </span>
          <span className="text-xs text-ink/50">
            {f.response_count === 1 ? "response" : "responses"}
          </span>
        </div>
        {f.responses_7d > 0 ? (
          <span className="rounded-full bg-mint-tint px-2 py-0.5 font-mono text-[11px] font-medium text-mint">
            +{f.responses_7d} this week
          </span>
        ) : (
          <span className="font-mono text-[11px] text-ink/35">none this week</span>
        )}
      </div>
      <div className="mt-3" title="Responses ÷ views, last 90 days">
        <div className="flex items-baseline justify-between text-[11px]">
          <span className="text-ink/50">Conversion</span>
          <span className={"font-mono tabular-nums " + (rate === null ? "text-ink/35" : "")}>
            {rate === null ? "not enough views" : formatRate(rate)}
          </span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink/[0.07]">
          {rate !== null && (
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${Math.max(2, rate * 100)}%` }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** Forms without responses: one specific, calm line instead of a row of zeros. */
function CardWaiting({ form: f }: { form: DashboardForm }) {
  const q = plural(f.question_count, "question");
  const { text, sub } =
    f.status === "draft"
      ? f.question_count === 0
        ? { text: "No questions yet", sub: "Empty draft" }
        : { text: "Ready to publish", sub: q }
      : f.status === "published"
        ? { text: "Waiting for the first response", sub: q }
        : { text: "Closed without responses", sub: q };
  return (
    <div className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2.5">
      <span
        aria-hidden
        className={
          "size-1.5 shrink-0 rounded-full " +
          (f.status === "published" ? "animate-pulse bg-mint" : "bg-ink/25")
        }
      />
      <div className="min-w-0">
        <p className="truncate text-[13px] text-ink/70">{text}</p>
        <p className="font-mono text-[11px] text-ink/40">{sub}</p>
      </div>
    </div>
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
  const target = active && sorts.length === 1 ? DEFAULT_SORT : next;
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
        {f.status === "published" && (
          <DropdownMenuItem asChild>
            <Link to="/forms/$formId/live" params={{ formId: f.id }}>
              <Presentation className="size-4" />
              Present live
            </Link>
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
