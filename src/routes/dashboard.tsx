import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, FileText, LogOut, Plus, User, Users, Check, Eye } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DeleteFormDialog } from "@/components/delete-form-dialog";
import { ShareFormDialog } from "@/components/share-form-dialog";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { getInitialsFromProfile } from "@/lib/utils";
import { DashboardAnalytics } from "@/components/dashboard/analytics";
import { DashboardInsights } from "@/components/dashboard/insights";
import { FormsToolbar } from "@/components/dashboard/forms-toolbar";
import {
  CategoryDialog,
  CategoryDot,
  ManageCategoriesDialog,
} from "@/components/dashboard/category-dialog";
import { useCategories } from "@/lib/categories";
import {
  UNCATEGORIZED,
  filterForms,
  DEFAULT_SORT,
  parseDashboardSearch,
  sortForms,
  type ActivityFilter,
  type DashboardSearch,
  type SortKey,
  type StatusFilter,
} from "@/lib/dashboard-filters";
import {
  FormsView,
  type DashboardForm,
  type FormActionHandlers,
  type ViewMode,
} from "@/components/dashboard/forms-view";
import type { FormStatus } from "@/lib/form-utils";
import { Logo } from "@/components/logo";
import { ThemeSubmenu } from "@/components/theme-menu";
import { PendingInvitations, RoleBadge } from "@/components/profile/team-section";
import { permissions, useWorkspaces, workspaceName, type WorkspaceRole } from "@/lib/workspace";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Flowform" },
      { name: "description", content: "Create and manage your Flowform forms." },
      { property: "og:title", content: "Dashboard — Flowform" },
      { property: "og:description", content: "Create and manage your Flowform forms." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): DashboardSearch => parseDashboardSearch(s),
  component: DashboardPage,
});

type FormRow = Pick<DashboardForm, "id" | "title" | "description" | "created_at" | "status">;

const PREFS_KEY = "flowform:dashboard-prefs";
type DashboardPrefs = { view: ViewMode; grouped: boolean };

function readPrefs(): DashboardPrefs {
  const fallback: DashboardPrefs = { view: "list", grouped: false };
  try {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<DashboardPrefs>;
    return {
      view: p.view === "grid" || p.view === "board" ? p.view : "list",
      grouped: p.grouped === true,
    };
  } catch {
    return fallback;
  }
}

function writePrefs(p: DashboardPrefs) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // Storage blocked (private mode etc.) — prefs just won't persist.
  }
}

function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const signingOutRef = useRef(false);

  useEffect(() => {
    if (!authLoading && !user && !signingOutRef.current) {
      navigate({ to: "/login", search: { redirect: "/dashboard" } });
    }
  }, [authLoading, user, navigate]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-surface text-ink">
        <div className="mx-auto max-w-6xl px-6 py-16 md:px-8">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="mt-4 h-5 w-96" />
        </div>
      </div>
    );
  }

  return (
    <DashboardAuthed userId={user.id} email={user.email ?? ""} signingOutRef={signingOutRef} />
  );
}

function DashboardAuthed({
  userId,
  email,
  signingOutRef,
}: {
  userId: string;
  email: string;
  signingOutRef: React.MutableRefObject<boolean>;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ---- Workspace (whose forms we're looking at) --------------------------
  const wsParam = Route.useSearch({ select: (s) => s.ws });
  const ownerId = wsParam ?? userId;
  const isOwnWorkspace = ownerId === userId;
  const { data: workspaces = [], isSuccess: workspacesLoaded } = useWorkspaces(userId);
  const currentWs = workspaces.find((w) => w.owner_id === ownerId);
  const role: WorkspaceRole | null = isOwnWorkspace ? "owner" : (currentWs?.role ?? null);
  const can = permissions(role);

  // A link to a workspace you're not (or no longer) in falls back to your own.
  useEffect(() => {
    if (wsParam && workspacesLoaded && !workspaces.some((w) => w.owner_id === wsParam)) {
      toast.error("You don't have access to that workspace");
      navigate({ to: "/dashboard", search: {}, replace: true });
    }
  }, [wsParam, workspacesLoaded, workspaces, navigate]);

  // Single round-trip: the `get_dashboard_forms` Postgres RPC returns each
  // owned form alongside its response_count and question_count. Previously
  // this required three .select() round-trips that transferred entire
  // form_id columns just to count them client-side.
  const {
    data: dashboardForms = [],
    isLoading,
    isError,
    refetch: refetchDashboardForms,
  } = useQuery({
    queryKey: ["dashboard-forms", ownerId],
    // The global 30s staleTime is fine for most queries, but this is the
    // primary landing view for data that changes from other tabs/devices
    // (creating or publishing a form elsewhere doesn't invalidate this
    // query's cache here). Always treat it as stale so window focus and
    // remounts refetch instead of silently showing an outdated list.
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dashboard_forms", { p_owner: ownerId });
      if (error) throw error;
      // `bigint` columns may come back as strings from PostgREST for very
      // large counts; coerce to numbers so the render path stays simple.
      return (data ?? []).map(
        (r): DashboardForm => ({
          ...r,
          status: r.status as FormStatus,
          category_id: r.category_id ?? null,
          category: r.category ?? null,
          category_color: r.category_color ?? null,
          last_response_at: r.last_response_at ?? null,
          response_count: Number(r.response_count),
          question_count: Number(r.question_count),
          responses_7d: Number(r.responses_7d),
          responses_90d: Number(r.responses_90d),
          views_90d: Number(r.views_90d),
        }),
      );
    },
  });

  const forms = dashboardForms;

  // ---- View preferences (persisted per browser) -------------------------
  const [prefs, setPrefs] = useState<DashboardPrefs>(readPrefs);
  const updatePrefs = (patch: Partial<DashboardPrefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      writePrefs(next);
      return next;
    });

  // ---- Sort + filters (URL search params) ------------------------------
  const search = Route.useSearch();
  const sort: SortKey = search.sort ?? DEFAULT_SORT;
  const statusFilter: StatusFilter = search.status ?? "all";
  const activity: ActivityFilter = search.activity ?? "any";
  const categoryFilter = search.cat ?? null;
  const query = search.q ?? "";
  const setSearch = (patch: Partial<DashboardSearch>) =>
    navigate({
      to: "/dashboard",
      search: (prev) => parseDashboardSearch({ ...prev, ...patch }),
      replace: true,
      // Same page, new filters: keep the user where they are instead of the
      // router's default jump to the top on navigation.
      resetScroll: false,
    });
  const clearFilters = () =>
    setSearch({ status: undefined, activity: undefined, cat: undefined, q: undefined });

  const { data: categories = [], isSuccess: categoriesLoaded } = useCategories(ownerId);
  const [manageOpen, setManageOpen] = useState(false);

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of forms) if (f.category_id) m.set(f.category_id, (m.get(f.category_id) ?? 0) + 1);
    return m;
  }, [forms]);
  const uncategorizedCount = forms.filter((f) => !f.category_id).length;

  // A filter pointing at a category that no longer exists falls back to All.
  useEffect(() => {
    if (!categoryFilter || !categoriesLoaded) return;
    const stale =
      categoryFilter === UNCATEGORIZED
        ? categories.length === 0
        : !categories.some((c) => c.id === categoryFilter);
    if (stale) setSearch({ cat: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, categories, categoriesLoaded]);

  // Status counts are faceted: they reflect every other active filter.
  const statusCounts = useMemo(() => {
    const base = filterForms(forms, { ...search, status: undefined });
    const m: Record<StatusFilter, number> = { all: base.length, published: 0, draft: 0, closed: 0 };
    for (const f of base) m[f.status] += 1;
    return m;
  }, [forms, search]);

  const visibleForms = useMemo(
    () => sortForms(filterForms(forms, search), sort),
    [forms, search, sort],
  );

  const groups = useMemo(() => {
    if (
      !prefs.grouped ||
      prefs.view === "board" ||
      categoryFilter !== null ||
      categories.length === 0
    )
      return null;
    const out = categories.map((c) => ({
      key: c.id,
      label: c.name,
      color: c.color as string | null,
      forms: visibleForms.filter((f) => f.category_id === c.id),
    }));
    out.push({
      key: UNCATEGORIZED,
      label: "Uncategorized",
      color: null,
      forms: visibleForms.filter((f) => !f.category_id),
    });
    return out.filter((g) => g.forms.length > 0);
  }, [prefs.grouped, prefs.view, categoryFilter, categories, visibleForms]);

  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, first_name, last_name")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const fullName = [profile?.first_name, profile?.last_name]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ");
  const firstName =
    profile?.first_name?.trim() || profile?.display_name?.trim() || fullName || email.split("@")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const [pendingPublish, setPendingPublish] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DashboardForm | null>(null);
  const [shareTarget, setShareTarget] = useState<FormRow | null>(null);
  const [categoryTarget, setCategoryTarget] = useState<DashboardForm | null>(null);

  const setCategory = useMutation({
    mutationFn: async ({ formId, categoryId }: { formId: string; categoryId: string | null }) => {
      const { error } = await supabase
        .from("forms")
        .update({ category_id: categoryId })
        .eq("id", formId)
        .eq("user_id", ownerId);
      if (error) throw error;
      return categoryId;
    },
    onSuccess: async (categoryId) => {
      setCategoryTarget(null);
      const name = categories.find((c) => c.id === categoryId)?.name;
      // If the current category filter no longer matches, the card vanishes
      // from view — offer a jump to where it went so the change is visible.
      const nowHidden =
        categoryFilter !== null &&
        (categoryFilter === UNCATEGORIZED ? categoryId !== null : categoryFilter !== categoryId);
      toast.success(
        categoryId ? `Moved to “${name ?? "category"}”` : "Category removed",
        nowHidden
          ? {
              action: {
                label: categoryId ? `Show ${name ?? "category"}` : "Show uncategorized",
                onClick: () => setSearch({ cat: categoryId ?? UNCATEGORIZED }),
              },
            }
          : undefined,
      );
      await queryClient.invalidateQueries({ queryKey: ["dashboard-forms", ownerId] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not update category"),
  });

  const duplicateForm = useMutation({
    // One transaction server-side: copies settings + questions and remaps
    // logic-jump targets to the new question ids.
    mutationFn: async (formId: string) => {
      const { data, error } = await supabase.rpc("copy_form", { p_form_id: formId });
      if (error) throw error;
      return data;
    },
    onSuccess: async (newId) => {
      toast.success("Form duplicated — opening the copy");
      await queryClient.invalidateQueries({ queryKey: ["dashboard-forms", ownerId] });
      navigate({ to: "/forms/$formId/edit", params: { formId: newId } });
    },
    onError: (e: Error) => toast.error(e.message || "Could not duplicate form"),
  });

  const deleteForm = useMutation({
    mutationFn: async (formId: string) => {
      // Cascades to questions + responses via ON DELETE CASCADE.
      const { error } = await supabase
        .from("forms")
        .delete()
        .eq("id", formId)
        .eq("user_id", ownerId);
      if (error) throw error;
    },
    onSuccess: async () => {
      setPendingDelete(null);
      toast.success("Form deleted");
      await queryClient.invalidateQueries({ queryKey: ["dashboard-forms", ownerId] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary", ownerId] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not delete form"),
  });

  const setFormStatus = useMutation({
    mutationFn: async ({ formId, status }: { formId: string; status: FormStatus }) => {
      const { error } = await supabase
        .from("forms")
        .update({ status })
        .eq("id", formId)
        .eq("user_id", ownerId);
      if (error) throw error;
      return status;
    },
    onSuccess: async (status) => {
      toast.success(
        status === "closed" ? "Form closed — no longer accepting responses" : "Form reopened",
      );
      await queryClient.invalidateQueries({ queryKey: ["dashboard-forms", ownerId] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not update form"),
  });

  const handleSignOut = async () => {
    signingOutRef.current = true;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err) {
      signingOutRef.current = false;
      const message = err instanceof Error ? err.message : "Could not sign out.";
      toast.error(message);
      return;
    }
    queryClient.clear();
    navigate({ to: "/" });
  };

  const doPublishAndShare = async (formId: string) => {
    setPendingPublish(null);
    try {
      const { error } = await supabase
        .from("forms")
        .update({ status: "published" })
        .eq("id", formId)
        .eq("user_id", ownerId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["dashboard-forms", ownerId] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary", ownerId] });
      toast.success("Form published");
      const row = dashboardForms.find((f) => f.id === formId);
      if (row) setShareTarget({ ...row, status: "published" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish form");
    }
  };

  const formActions: FormActionHandlers = {
    canEdit: can.canEdit,
    canDelete: can.canDelete,
    onShare: (f) => (f.status === "draft" ? setPendingPublish(f.id) : setShareTarget(f)),
    onDuplicate: (f) => duplicateForm.mutate(f.id),
    onSetStatus: (f, status) => setFormStatus.mutate({ formId: f.id, status }),
    onCategory: (f) => setCategoryTarget(f),
    onDelete: (f) => setPendingDelete(f),
    duplicatePending: duplicateForm.isPending,
  };

  const filtering =
    categoryFilter !== null || query.trim() !== "" || statusFilter !== "all" || activity !== "any";
  const onSort = (next: SortKey) => setSearch({ sort: next === DEFAULT_SORT ? undefined : next });

  // One-line pulse under the title: the week at a glance.
  const liveCount = forms.filter((f) => f.status === "published").length;
  const weekResponses = forms.reduce((n, f) => n + f.responses_7d, 0);
  const pulse = isLoading
    ? ""
    : forms.length === 0
      ? "Create your first form to start collecting responses."
      : weekResponses > 0
        ? `${weekResponses} new ${weekResponses === 1 ? "response" : "responses"} this week across ${liveCount} live ${liveCount === 1 ? "form" : "forms"}.`
        : liveCount > 0
          ? `No new responses this week. ${liveCount} ${liveCount === 1 ? "form is" : "forms are"} live.`
          : "Nothing is live yet. Publish a form to start collecting.";

  return (
    <div className="min-h-screen bg-surface text-ink">
      <header className="border-b border-hairline">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 md:px-8">
          <Link to="/" className="flex items-center gap-2">
            <Logo />
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Open account menu"
              className="flex size-9 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand outline-none transition-all hover:bg-brand/15 focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              {getInitialsFromProfile(
                profile?.first_name,
                profile?.last_name,
                profile?.display_name,
                email,
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="px-2 py-2">
                <p className="truncate text-sm font-semibold text-ink">
                  {fullName || profile?.display_name?.trim() || "Account"}
                </p>
                <p className="truncate text-xs text-ink/60">{email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
                <User className="size-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/profile", hash: "team" })}>
                <Users className="size-4" />
                Team & roles
              </DropdownMenuItem>
              <ThemeSubmenu userId={userId} />
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-8 md:px-8 md:pt-12">
        <PendingInvitations userId={userId} compact />

        {/* Page header: where am I, how is it going, what do I do next. */}
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 [&:not(:first-child)]:mt-8">
          <div className="min-w-0">
            {workspaces.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger className="mb-3 inline-flex h-8 items-center gap-2 rounded-full border border-hairline bg-card pl-3 pr-2.5 text-xs text-ink/70 outline-none transition-colors hover:border-ink/25 hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/40">
                  <Users className="size-3.5" />
                  {currentWs ? workspaceName(currentWs) : "My workspace"}
                  <ChevronDown className="size-3 opacity-60" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72">
                  <DropdownMenuLabel className="text-xs font-normal text-ink/50">
                    Switch workspace
                  </DropdownMenuLabel>
                  {workspaces.map((w) => (
                    <DropdownMenuItem
                      key={w.owner_id}
                      onClick={() =>
                        navigate({
                          to: "/dashboard",
                          search: w.owner_id === userId ? {} : { ws: w.owner_id },
                        })
                      }
                      className="items-start gap-3"
                    >
                      <span className="mt-0.5 flex size-4 items-center justify-center">
                        {w.owner_id === ownerId && <Check className="size-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{workspaceName(w)}</span>
                        <span className="block text-xs text-ink/50">
                          {w.form_count} {w.form_count === 1 ? "form" : "forms"}
                        </span>
                      </span>
                      <RoleBadge role={w.role} />
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate({ to: "/profile", hash: "team" })}>
                    <Users className="size-4" />
                    Manage team
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <h1 className="font-display text-3xl font-medium tracking-tight md:text-4xl">
              {isOwnWorkspace ? "Forms" : currentWs ? workspaceName(currentWs) : "Forms"}
            </h1>
            <p className="mt-2 text-sm text-ink/60">
              {isOwnWorkspace ? (
                <>
                  {greeting}, <span className="text-ink">{firstName}</span>. {pulse}
                </>
              ) : role ? (
                <span className="inline-flex flex-wrap items-center gap-2">
                  You're here as <RoleBadge role={role} />
                  {!can.canEdit && (
                    <span className="inline-flex items-center gap-1 text-sm">
                      <Eye className="size-3.5" /> View-only — responses and analytics are open to
                      you.
                    </span>
                  )}
                </span>
              ) : null}
            </p>
          </div>
          {can.canEdit && (
            <Link
              to="/forms/new"
              search={isOwnWorkspace ? {} : { ws: ownerId }}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-ink px-3.5 text-sm font-medium text-paper outline-none transition-colors hover:bg-ink/85 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2"
            >
              <Plus className="size-4" />
              New form
            </Link>
          )}
        </div>

        {!isError && (forms.length > 0 || isLoading) && (
          <div className="mt-8 space-y-3">
            <DashboardAnalytics ownerId={ownerId} />
            {!isLoading && (
              <DashboardInsights
                forms={forms}
                canEdit={can.canEdit}
                onFilter={(patch) => {
                  setSearch({ ...patch, cat: undefined, q: undefined });
                  document
                    .getElementById("forms-list")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              />
            )}
          </div>
        )}

        <section id="forms-list" aria-labelledby="forms-list-heading" className="mt-12 scroll-mt-6">
          <div className="mb-3 flex items-baseline gap-3">
            <h2 id="forms-list-heading" className="text-[15px] font-medium">
              {isOwnWorkspace ? "Your forms" : "Forms"}
            </h2>
            {!isLoading && !isError && filtering && (
              <span className="font-mono text-xs text-ink/45">
                {visibleForms.length} of {forms.length} shown
              </span>
            )}
          </div>

          {!isLoading && !isError && forms.length > 0 && (
            <FormsToolbar
              search={search}
              setSearch={setSearch}
              statusCounts={statusCounts}
              categories={categories}
              categoryCounts={categoryCounts}
              uncategorizedCount={uncategorizedCount}
              grouped={prefs.grouped}
              onGrouped={(grouped) => updatePrefs({ grouped })}
              view={prefs.view}
              onView={(view) => updatePrefs({ view })}
              onManageCategories={() => setManageOpen(true)}
              canManageCategories={can.canEdit}
            />
          )}

          <div className="mt-4">
            {isLoading && (
              <div className="overflow-hidden rounded-xl border border-hairline bg-card">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-4 border-b border-hairline px-4 py-4 last:border-0"
                  >
                    <div className="flex-1">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="mt-2 h-3 w-1/4" />
                    </div>
                    <Skeleton className="h-7 w-20" />
                  </div>
                ))}
              </div>
            )}

            {!isLoading && isError && (
              <div className="flex flex-col items-center rounded-xl border border-dashed border-destructive/30 bg-card px-6 py-14 text-center">
                <FileText className="size-6 text-destructive" strokeWidth={1.5} />
                <h3 className="mt-4 text-lg font-medium">Couldn't load your forms</h3>
                <p className="mt-2 max-w-sm text-sm text-ink/60">
                  Your forms are safe. This is only a loading problem.
                </p>
                <button
                  type="button"
                  onClick={() => refetchDashboardForms()}
                  className="mt-6 inline-flex h-9 items-center justify-center rounded-md bg-ink px-4 text-sm font-medium text-paper transition-colors hover:bg-ink/85"
                >
                  Try again
                </button>
              </div>
            )}

            {!isLoading && !isError && forms.length === 0 && (
              <EmptyWorkspace canCreate={can.canEdit} ownerId={isOwnWorkspace ? null : ownerId} />
            )}

            {!isLoading && !isError && forms.length > 0 && visibleForms.length === 0 && (
              <div className="flex flex-col items-center rounded-xl border border-dashed border-ink/20 px-6 py-12 text-center">
                <p className="text-sm font-medium">No forms match</p>
                <p className="mt-1 text-sm text-ink/55">
                  Try a different search, or widen the filters.
                </p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 text-sm font-medium text-brand hover:underline"
                >
                  Clear filters
                </button>
              </div>
            )}

            {!isLoading && !isError && visibleForms.length > 0 && groups && (
              <div className="space-y-8">
                {groups.map((g) => (
                  <div key={g.key}>
                    <div className="mb-2.5 flex items-center gap-2">
                      {g.key !== UNCATEGORIZED && <CategoryDot color={g.color} />}
                      <h3
                        className={
                          "text-sm font-medium " + (g.key === UNCATEGORIZED ? "text-ink/50" : "")
                        }
                      >
                        {g.label}
                      </h3>
                      <span className="font-mono text-[11px] text-ink/40">{g.forms.length}</span>
                    </div>
                    <FormsView
                      forms={g.forms}
                      view={prefs.view}
                      actions={formActions}
                      sort={sort}
                      onSort={onSort}
                    />
                  </div>
                ))}
              </div>
            )}

            {!isLoading && !isError && visibleForms.length > 0 && !groups && (
              <FormsView
                forms={visibleForms}
                view={prefs.view}
                actions={formActions}
                sort={sort}
                onSort={onSort}
              />
            )}
          </div>
        </section>
      </main>

      <DeleteFormDialog
        open={pendingDelete !== null}
        formTitle={pendingDelete?.title ?? ""}
        responseCount={pendingDelete?.response_count}
        pending={deleteForm.isPending}
        onConfirm={() => pendingDelete && deleteForm.mutate(pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={pendingPublish !== null}
        title="Publish this form?"
        description="This will make the form visible to anyone with the link. You can unpublish it later from the editor."
        confirmLabel="Publish and share"
        onConfirm={() => pendingPublish && doPublishAndShare(pendingPublish)}
        onCancel={() => setPendingPublish(null)}
      />

      <CategoryDialog
        open={categoryTarget !== null}
        userId={ownerId}
        formTitle={categoryTarget?.title ?? ""}
        currentId={categoryTarget?.category_id ?? null}
        pending={setCategory.isPending}
        onSave={(categoryId) =>
          categoryTarget && setCategory.mutate({ formId: categoryTarget.id, categoryId })
        }
        onCancel={() => setCategoryTarget(null)}
      />

      <ManageCategoriesDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        userId={ownerId}
        formCounts={categoryCounts}
      />

      <ShareFormDialog
        open={shareTarget !== null}
        onOpenChange={(open) => !open && setShareTarget(null)}
        formId={shareTarget?.id ?? ""}
        formTitle={shareTarget?.title ?? ""}
      />
    </div>
  );
}

/** First-run state: what Flowform does in three steps, and one way in. */
function EmptyWorkspace({ canCreate, ownerId }: { canCreate: boolean; ownerId: string | null }) {
  const steps = [
    {
      n: "1",
      title: "Build",
      body: "Start from a template, a blank page, or a one-line goal for Claude.",
    },
    {
      n: "2",
      title: "Share",
      body: "Publish and send the link. Respondents answer one question at a time.",
    },
    { n: "3", title: "Learn", body: "Watch responses, drop-off and AI summaries arrive here." },
  ];
  return (
    <div className="rounded-xl border border-hairline bg-card px-6 py-12 text-center md:px-10">
      <h3 className="text-xl font-medium">
        {canCreate ? "Create your first form" : "No forms in this workspace yet"}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink/60">
        {canCreate
          ? "Most people have their first form live in under five minutes."
          : "When an editor creates a form, it will appear here with its results."}
      </p>
      {canCreate && (
        <>
          <ol className="mx-auto mt-8 grid max-w-3xl gap-3 text-left sm:grid-cols-3">
            {steps.map((s) => (
              <li key={s.n} className="rounded-lg border border-hairline bg-surface p-4">
                <span className="font-mono text-[11px] text-ink/40">{s.n}</span>
                <p className="mt-1 text-sm font-medium">{s.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink/55">{s.body}</p>
              </li>
            ))}
          </ol>
          <Link
            to="/forms/new"
            search={ownerId ? { ws: ownerId } : {}}
            className="mt-8 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-ink px-5 text-sm font-medium text-paper transition-colors hover:bg-ink/85"
          >
            <Plus className="size-4" />
            New form
          </Link>
        </>
      )}
    </div>
  );
}
