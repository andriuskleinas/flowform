import {
  ListFilter,
  LayoutGrid,
  List,
  Search,
  Settings2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useEffect, useRef } from "react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CategoryDot } from "@/components/dashboard/category-dialog";
import type { ViewMode } from "@/components/dashboard/forms-view";
import type { FormCategory } from "@/lib/categories";
import {
  ACTIVITY_OPTIONS,
  DEFAULT_SORT,
  SORT_OPTIONS,
  STATUS_OPTIONS,
  UNCATEGORIZED,
  type ActivityFilter,
  type DashboardSearch,
  type SortKey,
  type StatusFilter,
} from "@/lib/dashboard-filters";

const control =
  "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand/40";
const idle = "border-hairline bg-card text-ink/65 hover:border-ink/25 hover:text-ink";
const engaged = "border-brand/30 bg-brand/[0.07] text-brand";

export function FormsToolbar({
  search,
  setSearch,
  statusCounts,
  categories,
  categoryCounts,
  uncategorizedCount,
  grouped,
  onGrouped,
  view,
  onView,
  onManageCategories,
  canManageCategories,
}: {
  search: DashboardSearch;
  setSearch: (patch: Partial<DashboardSearch>) => void;
  statusCounts: Record<StatusFilter, number>;
  categories: FormCategory[];
  categoryCounts: Map<string, number>;
  uncategorizedCount: number;
  grouped: boolean;
  onGrouped: (v: boolean) => void;
  view: ViewMode;
  onView: (v: ViewMode) => void;
  onManageCategories: () => void;
  canManageCategories: boolean;
}) {
  const status: StatusFilter = search.status ?? "all";
  const activity: ActivityFilter = search.activity ?? "any";
  const sort: SortKey = search.sort ?? DEFAULT_SORT;
  const cat = search.cat ?? null;
  const query = search.q ?? "";
  const activeFilters = (cat ? 1 : 0) + (activity !== "any" ? 1 : 0);

  const catLabel =
    cat === UNCATEGORIZED ? "Uncategorized" : categories.find((c) => c.id === cat)?.name;
  const catColor = categories.find((c) => c.id === cat)?.color ?? null;
  const activityLabel = ACTIVITY_OPTIONS.find((o) => o.key === activity)?.label;

  // "/" focuses search, the way most list-heavy tools do.
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-hairline md:flex-row md:items-end md:justify-between">
        {/* Status tabs */}
        <div
          role="tablist"
          aria-label="Filter by status"
          className="-mb-px flex gap-5 overflow-x-auto"
        >
          {STATUS_OPTIONS.map((o) => {
            const active = status === o.key;
            return (
              <button
                key={o.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSearch({ status: o.key === "all" ? undefined : o.key })}
                className={
                  "inline-flex shrink-0 items-center gap-1.5 border-b-2 pb-2.5 pt-1 text-sm outline-none transition-colors focus-visible:text-ink " +
                  (active
                    ? "border-ink font-medium text-ink"
                    : "border-transparent text-ink/50 hover:text-ink")
                }
              >
                {o.label}
                <span
                  className={
                    "rounded px-1 font-mono text-[10px] tabular-nums " +
                    (active ? "bg-ink/[0.07] text-ink/70" : "text-ink/35")
                  }
                >
                  {statusCounts[o.key]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 pb-2.5">
          <div className="relative min-w-0 flex-1 md:flex-none">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink/40" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setSearch({ q: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearch({ q: undefined });
                  e.currentTarget.blur();
                }
              }}
              placeholder="Search forms"
              aria-label="Search forms"
              className="h-8 w-full rounded-md border border-hairline bg-card pl-8 pr-7 text-sm outline-none transition-[width] placeholder:text-ink/40 focus:border-brand/40 focus:ring-2 focus:ring-brand/15 md:w-48 md:focus:w-60 [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch({ q: undefined })}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink/40 hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-hairline px-1 font-mono text-[10px] text-ink/35 md:block">
                /
              </kbd>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger className={`${control} ${activeFilters ? engaged : idle}`}>
              <ListFilter className="size-3.5" />
              <span className="hidden sm:inline">Filter</span>
              {activeFilters > 0 && (
                <span className="rounded-full bg-brand px-1.5 font-mono text-[10px] leading-4 text-brand-foreground">
                  {activeFilters}
                </span>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-[70vh] w-64 overflow-y-auto">
              <DropdownMenuLabel className="text-xs font-normal text-ink/50">
                Category
              </DropdownMenuLabel>
              {categories.length === 0 && !canManageCategories ? (
                <p className="px-2 pb-1.5 text-xs text-ink/45">No categories in this workspace.</p>
              ) : categories.length === 0 ? (
                <DropdownMenuItem onClick={onManageCategories}>
                  <Settings2 className="size-4" />
                  Create categories…
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuRadioGroup
                    value={cat ?? "all"}
                    onValueChange={(v) => setSearch({ cat: v === "all" ? undefined : v })}
                  >
                    <DropdownMenuRadioItem value="all">Any category</DropdownMenuRadioItem>
                    {categories.map((c) => (
                      <DropdownMenuRadioItem key={c.id} value={c.id} className="gap-2">
                        <CategoryDot color={c.color} />
                        <span className="flex-1 truncate">{c.name}</span>
                        <span className="font-mono text-[10px] text-ink/40">
                          {categoryCounts.get(c.id) ?? 0}
                        </span>
                      </DropdownMenuRadioItem>
                    ))}
                    {uncategorizedCount > 0 && (
                      <DropdownMenuRadioItem value={UNCATEGORIZED}>
                        <span className="flex-1 text-ink/60">Uncategorized</span>
                        <span className="font-mono text-[10px] text-ink/40">
                          {uncategorizedCount}
                        </span>
                      </DropdownMenuRadioItem>
                    )}
                  </DropdownMenuRadioGroup>
                  {canManageCategories && (
                    <DropdownMenuItem onClick={onManageCategories} className="text-ink/60">
                      <Settings2 className="size-4" />
                      Manage categories…
                    </DropdownMenuItem>
                  )}
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal text-ink/50">
                Activity
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={activity}
                onValueChange={(v) =>
                  setSearch({ activity: v === "any" ? undefined : (v as ActivityFilter) })
                }
              >
                {ACTIVITY_OPTIONS.map((o) => (
                  <DropdownMenuRadioItem key={o.key} value={o.key} className="items-start">
                    <div>
                      <p className="text-sm">{o.label}</p>
                      {o.hint && <p className="text-xs text-ink/50">{o.hint}</p>}
                    </div>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger
              className={`${control} ${sort !== DEFAULT_SORT || grouped ? engaged : idle}`}
            >
              <SlidersHorizontal className="size-3.5" />
              <span className="hidden sm:inline">Display</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs font-normal text-ink/50">
                Order by
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={sort}
                onValueChange={(v) =>
                  setSearch({ sort: v === DEFAULT_SORT ? undefined : (v as SortKey) })
                }
              >
                {SORT_OPTIONS.map((o) => (
                  <DropdownMenuRadioItem key={o.key} value={o.key}>
                    {o.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              {categories.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={grouped}
                    onCheckedChange={(v) => onGrouped(v === true)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    Group by category
                  </DropdownMenuCheckboxItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <div
            role="radiogroup"
            aria-label="Layout"
            className="inline-flex shrink-0 rounded-md border border-hairline bg-card p-0.5"
          >
            {(
              [
                { mode: "list", label: "List", Icon: List },
                { mode: "grid", label: "Cards", Icon: LayoutGrid },
              ] as const
            ).map(({ mode, label, Icon }) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={view === mode}
                aria-label={`${label} layout`}
                title={label}
                onClick={() => onView(mode)}
                className={
                  "rounded p-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand/40 " +
                  (view === mode ? "bg-ink text-paper" : "text-ink/45 hover:text-ink")
                }
              >
                <Icon className="size-3.5" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {(activeFilters > 0 || query.trim()) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {cat && catLabel && (
            <Chip onRemove={() => setSearch({ cat: undefined })} label="Category">
              {cat !== UNCATEGORIZED && <CategoryDot color={catColor} />}
              {catLabel}
            </Chip>
          )}
          {activity !== "any" && (
            <Chip onRemove={() => setSearch({ activity: undefined })} label="Activity">
              {activityLabel}
            </Chip>
          )}
          {query.trim() && (
            <Chip onRemove={() => setSearch({ q: undefined })} label="Search">
              “{query.trim()}”
            </Chip>
          )}
          <button
            type="button"
            onClick={() =>
              setSearch({ status: undefined, activity: undefined, cat: undefined, q: undefined })
            }
            className="px-1 text-xs font-medium text-brand hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

function Chip({
  label,
  children,
  onRemove,
}: {
  label: string;
  children: React.ReactNode;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-hairline bg-card pl-2.5 pr-1 text-xs">
      <span className="text-ink/45">{label}:</span>
      <span className="inline-flex max-w-[14rem] items-center gap-1.5 truncate font-medium">
        {children}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label.toLowerCase()} filter`}
        className="rounded-full p-0.5 text-ink/40 hover:bg-ink/5 hover:text-ink"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
