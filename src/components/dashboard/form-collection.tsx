import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  CircleSlash,
  CirclePlay,
  CopyPlus,
  FileText,
  MoreHorizontal,
  Pencil,
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
import { timeAgo } from "@/lib/utils";
import type { FormStatus } from "@/lib/form-utils";

export type DashboardForm = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  status: FormStatus;
  category: string | null;
  response_count: number;
  question_count: number;
  last_response_at: string | null;
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
}: {
  forms: DashboardForm[];
  view: ViewMode;
  actions: FormActionHandlers;
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
    return <FormTable forms={forms} actions={actions} />;
  }
  return (
    <ul className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-white">
      {forms.map((f) => (
        <ListRow key={f.id} form={f} actions={actions} />
      ))}
    </ul>
  );
}

function CategoryTag({ category }: { category: string | null }) {
  if (!category) return null;
  return (
    <span className="inline-flex max-w-[12rem] items-center gap-1 truncate rounded-sm bg-brand/[0.07] px-1.5 py-0.5 text-[11px] font-medium text-brand">
      <Tag className="size-3 shrink-0" />
      <span className="truncate">{category}</span>
    </span>
  );
}

function ListRow({ form: f, actions }: { form: DashboardForm; actions: FormActionHandlers }) {
  return (
    <li className="group p-4 transition-colors hover:bg-paper">
      <div className="flex items-start justify-between gap-4">
        <Link
          to="/forms/$formId/edit"
          params={{ formId: f.id }}
          className="flex min-w-0 flex-1 items-start gap-3"
        >
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface text-ink/50">
            <FileText className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-[15px] font-medium tracking-normal">{f.title}</h3>
              <StatusPill status={f.status} />
              <CategoryTag category={f.category} />
            </div>
            {f.description && (
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink/60">
                {f.description}
              </p>
            )}
            <p className="mt-1.5 font-mono text-[11px] text-ink/45">
              {plural(f.question_count, "question", "questions")} ·{" "}
              {plural(f.response_count, "response", "responses")} · {timeAgo(f.created_at)}
            </p>
          </div>
        </Link>
        <FormActions form={f} actions={actions} />
      </div>
    </li>
  );
}

function GridCard({ form: f, actions }: { form: DashboardForm; actions: FormActionHandlers }) {
  return (
    <li className="group relative flex flex-col rounded-lg border border-hairline bg-white transition-colors hover:border-ink/20">
      <Link
        to="/forms/$formId/edit"
        params={{ formId: f.id }}
        className="flex flex-1 flex-col p-4 pb-3"
      >
        <div className="flex items-center gap-2 pr-8">
          <StatusPill status={f.status} />
          <CategoryTag category={f.category} />
        </div>
        <h3 className="mt-3 line-clamp-2 text-[15px] font-medium leading-snug tracking-normal">
          {f.title}
        </h3>
        <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-ink/55">
          {f.description || <span className="text-ink/30">No description</span>}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-md bg-surface px-2.5 py-2">
            <dt className="text-[11px] text-ink/50">Responses</dt>
            <dd className="text-lg font-medium tabular-nums">{f.response_count}</dd>
          </div>
          <div className="rounded-md bg-surface px-2.5 py-2">
            <dt className="text-[11px] text-ink/50">Questions</dt>
            <dd className="text-lg font-medium tabular-nums">{f.question_count}</dd>
          </div>
        </dl>
      </Link>
      <div className="flex items-center justify-between border-t border-hairline py-1 pl-4 pr-1">
        <span className="font-mono text-[11px] text-ink/45">
          {f.last_response_at
            ? `last reply ${timeAgo(f.last_response_at)}`
            : `created ${timeAgo(f.created_at)}`}
        </span>
        <FormActions form={f} actions={actions} compact />
      </div>
    </li>
  );
}

function FormTable({ forms, actions }: { forms: DashboardForm[]; actions: FormActionHandlers }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-hairline bg-white">
      <table className="w-full min-w-[720px] table-fixed text-sm">
        {/* Fixed column widths keep grouped tables aligned with each other. */}
        <colgroup>
          <col />
          <col className="w-[104px]" />
          <col className="w-[140px]" />
          <col className="w-[52px]" />
          <col className="w-[96px]" />
          <col className="w-[96px]" />
          <col className="w-[88px]" />
          <col className="w-[48px]" />
        </colgroup>
        <thead>
          <tr className="border-b border-hairline text-left text-xs text-ink/50">
            <th className="px-4 py-2.5 font-medium">Form</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 font-medium">Category</th>
            <th className="px-3 py-2.5 text-right font-medium">Qs</th>
            <th className="px-3 py-2.5 text-right font-medium">Responses</th>
            <th className="px-3 py-2.5 font-medium">Last reply</th>
            <th className="px-3 py-2.5 font-medium">Created</th>
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
                {f.category ? (
                  <CategoryTag category={f.category} />
                ) : (
                  <span className="text-ink/30">—</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-ink/70">
                {f.question_count}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                {f.response_count}
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
            {f.category ? "Change category" : "Set category"}
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
