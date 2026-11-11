import type { FormStatus } from "@/lib/form-utils";

/**
 * Dashboard sort + filter model. Lives in the URL (?sort=…&status=…) so a
 * filtered view survives reloads, works with Back, and can be bookmarked.
 * Defaults are omitted from the URL to keep it clean.
 */

export const SORT_OPTIONS = [
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "most", label: "Most responses" },
  { key: "fewest", label: "Fewest responses" },
  { key: "trending", label: "Trending (7 days)" },
  { key: "recent", label: "Recently active" },
  { key: "completion", label: "Best completion rate" },
  { key: "title", label: "Title A–Z" },
] as const;
export type SortKey = (typeof SORT_OPTIONS)[number]["key"];

export const STATUS_OPTIONS = [
  { key: "all", label: "All" },
  { key: "published", label: "Live" },
  { key: "draft", label: "Draft" },
  { key: "closed", label: "Closed" },
] as const;
export type StatusFilter = (typeof STATUS_OPTIONS)[number]["key"];

export const ACTIVITY_OPTIONS = [
  { key: "any", label: "Any activity", hint: "" },
  { key: "active", label: "Active", hint: "A response in the last 7 days" },
  { key: "quiet", label: "Quiet", hint: "Live, but no response in 30+ days" },
  { key: "none", label: "No responses yet", hint: "Nothing collected so far" },
] as const;
export type ActivityFilter = (typeof ACTIVITY_OPTIONS)[number]["key"];

/** Category filter: a category id, or "none" for uncategorized. */
export const UNCATEGORIZED = "none";

export type DashboardSearch = {
  sort?: SortKey;
  status?: StatusFilter;
  activity?: ActivityFilter;
  cat?: string;
  q?: string;
  /** Workspace (owner user id) being viewed; absent = your own. */
  ws?: string;
};

const pick = <T extends string>(v: unknown, allowed: readonly { key: T }[], fallback: T) =>
  typeof v === "string" && allowed.some((o) => o.key === v) ? (v as T) : fallback;

export function parseDashboardSearch(s: Record<string, unknown>): DashboardSearch {
  const sort = pick(s.sort, SORT_OPTIONS, "newest");
  const status = pick(s.status, STATUS_OPTIONS, "all");
  const activity = pick(s.activity, ACTIVITY_OPTIONS, "any");
  const cat = typeof s.cat === "string" && s.cat.length <= 64 ? s.cat : undefined;
  const q = typeof s.q === "string" && s.q.trim() ? s.q.slice(0, 100) : undefined;
  const ws =
    typeof s.ws === "string" && /^[0-9a-f-]{36}$/i.test(s.ws) ? s.ws.toLowerCase() : undefined;
  return {
    sort: sort === "newest" ? undefined : sort,
    status: status === "all" ? undefined : status,
    activity: activity === "any" ? undefined : activity,
    cat,
    q,
    ws,
  };
}

/** The subset of a dashboard row these helpers need. */
export type Rankable = {
  title: string;
  description: string | null;
  created_at: string;
  status: FormStatus;
  category_id: string | null;
  category: string | null;
  response_count: number;
  last_response_at: string | null;
  responses_7d: number;
  responses_90d: number;
  views_90d: number;
};

/** Below this many views the rate is noise, so it isn't shown or ranked. */
export const MIN_VIEWS_FOR_RATE = 5;

/** Responses ÷ views over the last 90 days, capped at 100%; null if too few views. */
export function completionRate(f: Pick<Rankable, "responses_90d" | "views_90d">): number | null {
  if (f.views_90d < MIN_VIEWS_FOR_RATE) return null;
  return Math.min(1, f.responses_90d / f.views_90d);
}

const DAY = 86_400_000;

export function matchesActivity(f: Rankable, activity: ActivityFilter, now = Date.now()) {
  const last = f.last_response_at ? new Date(f.last_response_at).getTime() : null;
  switch (activity) {
    case "active":
      return last !== null && now - last <= 7 * DAY;
    case "quiet":
      return f.status === "published" && (last === null || now - last > 30 * DAY);
    case "none":
      return f.response_count === 0;
    default:
      return true;
  }
}

export function filterForms<T extends Rankable>(
  forms: T[],
  { status = "all", activity = "any", cat, q }: DashboardSearch,
): T[] {
  const needle = q?.trim().toLowerCase() ?? "";
  const now = Date.now();
  return forms.filter((f) => {
    if (status !== "all" && f.status !== status) return false;
    if (cat === UNCATEGORIZED ? f.category_id !== null : cat && f.category_id !== cat) return false;
    if (!matchesActivity(f, activity, now)) return false;
    if (!needle) return true;
    return (
      f.title.toLowerCase().includes(needle) ||
      (f.description ?? "").toLowerCase().includes(needle) ||
      (f.category ?? "").toLowerCase().includes(needle)
    );
  });
}

const time = (iso: string | null) => (iso ? new Date(iso).getTime() : -Infinity);

/** Stable sort; ties fall back to newest first so order never jitters. */
export function sortForms<T extends Rankable>(forms: T[], sort: SortKey = "newest"): T[] {
  const newest = (a: T, b: T) => time(b.created_at) - time(a.created_at);
  const by: Record<SortKey, (a: T, b: T) => number> = {
    newest,
    oldest: (a, b) => -newest(a, b),
    most: (a, b) => b.response_count - a.response_count || newest(a, b),
    fewest: (a, b) => a.response_count - b.response_count || newest(a, b),
    trending: (a, b) =>
      b.responses_7d - a.responses_7d || b.response_count - a.response_count || newest(a, b),
    recent: (a, b) => time(b.last_response_at) - time(a.last_response_at) || newest(a, b),
    completion: (a, b) => {
      // Forms without enough views to rate sink to the bottom.
      const ra = completionRate(a) ?? -1;
      const rb = completionRate(b) ?? -1;
      return rb - ra || b.views_90d - a.views_90d || newest(a, b);
    },
    title: (a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" }) || newest(a, b),
  };
  return [...forms].sort(by[sort]);
}

export function formatRate(rate: number | null) {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}
