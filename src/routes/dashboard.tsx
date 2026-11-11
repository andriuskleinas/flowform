import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  ChevronDown,
  FileText,
  Activity,
  LayoutGrid,
  List,
  LogOut,
  Plus,
  Rows3,
  Search,
  Settings2,
  Table2,
  User,
  Users,
  Check,
  Eye,
  X,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
import { DashboardSummaryPanel } from "@/components/dashboard/summary";
import {
  CategoryDialog,
  CategoryDot,
  ManageCategoriesDialog,
} from "@/components/dashboard/category-dialog";
import { useCategories } from "@/lib/categories";
import {
  ACTIVITY_OPTIONS,
  SORT_OPTIONS,
  STATUS_OPTIONS,
  UNCATEGORIZED,
  filterForms,
  parseDashboardSearch,
  sortForms,
  type ActivityFilter,
  type DashboardSearch,
  type SortKey,
  type StatusFilter,
} from "@/lib/dashboard-filters";
import {
  FormCollection,
  type DashboardForm,
  type FormActionHandlers,
  type ViewMode,
} from "@/components/dashboard/form-collection";
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
      view: p.view === "grid" || p.view === "table" ? p.view : "list",
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

function CategoryChip({
  active,
  onClick,
  label,
  count,
  muted = false,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  muted?: boolean;
  color?: string | null;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors " +
        (active
          ? "border-ink bg-ink text-paper"
          : "border-hairline bg-card hover:border-ink/25 " +
            (muted ? "text-ink/50 hover:text-ink" : "text-ink/75 hover:text-ink"))
      }
    >
      {color !== undefined && <CategoryDot color={color} />}
      <span className="max-w-[10rem] truncate">{label}</span>
      <span className={"font-mono text-[10px] " + (active ? "text-paper/60" : "text-ink/40")}>
        {count}
      </span>
    </button>
  );
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
  const sort: SortKey = search.sort ?? "newest";
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
    if (!prefs.grouped || categoryFilter !== null || categories.length === 0) return null;
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
  }, [prefs.grouped, categoryFilter, categories, visibleForms]);

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
  const greetingName = fullName || profile?.display_name?.trim() || email;

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
    mutationFn: async (formId: string) => {
      const { data: src, error: srcErr } = await supabase
        .from("forms")
        .select("title, description, display_mode, category_id")
        .eq("id", formId)
        .single();
      if (srcErr) throw srcErr;
      const { data: qs, error: qErr } = await supabase
        .from("questions")
        .select("id, type, label, options, position, required, logic")
        .eq("form_id", formId)
        .order("position", { ascending: true });
      if (qErr) throw qErr;
      const { data: created, error: insErr } = await supabase
        .from("forms")
        .insert({
          // Stay under the 300-char title constraint even with the suffix.
          title: `${src.title.slice(0, 290)} (copy)`,
          description: src.description,
          display_mode: src.display_mode,
          category_id: src.category_id,
          user_id: ownerId,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      if (qs && qs.length > 0) {
        // Insert copies without logic first, then remap jump targets from the
        // source question ids to the freshly created ids (matched by
        // position, which is unique within a form).
        const { data: inserted, error: qInsErr } = await supabase
          .from("questions")
          .insert(
            qs.map((q) => ({
              form_id: created.id,
              type: q.type,
              label: q.label,
              options: q.options,
              position: q.position,
              required: q.required,
            })),
          )
          .select("id, position");
        if (qInsErr) throw qInsErr;
        const idByPosition = new Map((inserted ?? []).map((r) => [r.position, r.id]));
        const oldToNew = new Map(qs.map((q) => [q.id, idByPosition.get(q.position)]));
        const logicUpdates = qs
          .filter((q) => q.logic && typeof q.logic === "object" && "jumps" in q.logic)
          .map((q) => {
            const jumps = (q.logic as { jumps: Record<string, string> }).jumps;
            const remapped: Record<string, string> = {};
            for (const [choice, target] of Object.entries(jumps)) {
              remapped[choice] = target === "end" ? "end" : (oldToNew.get(target) ?? "");
            }
            for (const k of Object.keys(remapped)) if (!remapped[k]) delete remapped[k];
            return { newId: oldToNew.get(q.id), jumps: remapped };
          })
          .filter((u) => u.newId && Object.keys(u.jumps).length > 0);
        await Promise.all(
          logicUpdates.map(async (u) => {
            const { error } = await supabase
              .from("questions")
              .update({ logic: { jumps: u.jumps } })
              .eq("id", u.newId!);
            if (error) throw error;
          }),
        );
      }
      return created.id as string;
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
  const sortLabel = SORT_OPTIONS.find((o) => o.key === sort)?.label ?? "Newest";
  const activityLabel = ACTIVITY_OPTIONS.find((o) => o.key === activity)?.label ?? "Any activity";

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

      <main className="mx-auto max-w-5xl px-6 pb-24 pt-10 md:px-8 md:pt-14">
        <PendingInvitations userId={userId} compact />

        <div className="max-w-2xl [&:not(:first-child)]:mt-8">
          {workspaces.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger className="mb-4 inline-flex h-8 items-center gap-2 rounded-full border border-hairline bg-card pl-3 pr-2.5 text-xs text-ink/70 outline-none transition-colors hover:border-ink/25 hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/40">
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
          <h1 className="font-display text-4xl md:text-5xl">
            {isOwnWorkspace ? "Your forms" : currentWs ? workspaceName(currentWs) : "Forms"}
          </h1>
          <p className="mt-3 text-base text-ink/60">
            {isOwnWorkspace ? (
              <>
                Welcome back, <span className="text-ink">{greetingName}</span>.
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

        {!isError && (forms.length > 0 || isLoading) && (
          <DashboardSummaryPanel userId={ownerId} forms={forms} formsLoading={isLoading} />
        )}

        <section aria-labelledby="forms-list-heading" className="mt-12">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h2 id="forms-list-heading" className="text-[15px] font-medium tracking-normal">
                All forms
              </h2>
              {!isLoading && !isError && (
                <span className="font-mono text-xs text-ink/45">
                  {filtering ? `${visibleForms.length} of ${forms.length}` : forms.length}{" "}
                  {forms.length === 1 ? "form" : "forms"}
                </span>
              )}
            </div>
            {can.canEdit && (
              <Link
                to="/forms/new"
                search={isOwnWorkspace ? {} : { ws: ownerId }}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-ink px-3.5 text-sm font-medium text-paper transition-colors hover:bg-ink/85"
              >
                <Plus className="size-4" />
                New form
              </Link>
            )}
          </div>

          {!isLoading && !isError && forms.length > 0 && (
            <div className="mt-4 space-y-3">
              {/* Row 1 — topics */}
              <div className="flex items-center gap-2">
                <div
                  role="tablist"
                  aria-label="Filter by category"
                  className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 pb-1 md:pb-0"
                >
                  <CategoryChip
                    active={categoryFilter === null}
                    onClick={() => setSearch({ cat: undefined })}
                    label="All topics"
                    count={forms.length}
                  />
                  {categories.map((c) => (
                    <CategoryChip
                      key={c.id}
                      active={categoryFilter === c.id}
                      onClick={() => setSearch({ cat: c.id })}
                      label={c.name}
                      color={c.color}
                      count={categoryCounts.get(c.id) ?? 0}
                    />
                  ))}
                  {categories.length > 0 && uncategorizedCount > 0 && (
                    <CategoryChip
                      active={categoryFilter === UNCATEGORIZED}
                      onClick={() => setSearch({ cat: UNCATEGORIZED })}
                      label="Uncategorized"
                      count={uncategorizedCount}
                      muted
                    />
                  )}
                </div>
                {can.canEdit && (
                  <button
                    type="button"
                    onClick={() => setManageOpen(true)}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-hairline bg-card px-2.5 text-xs text-ink/60 transition-colors hover:border-ink/25 hover:text-ink"
                  >
                    {categories.length === 0 ? (
                      <>
                        <Plus className="size-3.5" /> Add categories
                      </>
                    ) : (
                      <>
                        <Settings2 className="size-3.5" /> Manage
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Row 2 — status, activity, sort, search, layout */}
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    role="radiogroup"
                    aria-label="Filter by status"
                    className="inline-flex rounded-md border border-hairline bg-card p-0.5"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <button
                        key={o.key}
                        type="button"
                        role="radio"
                        aria-checked={statusFilter === o.key}
                        onClick={() => setSearch({ status: o.key === "all" ? undefined : o.key })}
                        className={
                          "inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-xs transition-colors " +
                          (statusFilter === o.key
                            ? "bg-ink text-paper"
                            : "text-ink/60 hover:bg-ink/5 hover:text-ink")
                        }
                      >
                        {o.label}
                        <span
                          className={
                            "font-mono text-[10px] " +
                            (statusFilter === o.key ? "text-paper/60" : "text-ink/35")
                          }
                        >
                          {statusCounts[o.key]}
                        </span>
                      </button>
                    ))}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className={
                        "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand/40 " +
                        (activity !== "any"
                          ? "border-brand/30 bg-brand/[0.07] text-brand"
                          : "border-hairline bg-card text-ink/60 hover:text-ink")
                      }
                    >
                      <Activity className="size-3.5" />
                      {activityLabel}
                      <ChevronDown className="size-3 opacity-60" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-64">
                      <DropdownMenuLabel className="text-xs font-normal text-ink/50">
                        Activity
                      </DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={activity}
                        onValueChange={(v) =>
                          setSearch({
                            activity: v === "any" ? undefined : (v as ActivityFilter),
                          })
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
                      className={
                        "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand/40 " +
                        (sort !== "newest"
                          ? "border-brand/30 bg-brand/[0.07] text-brand"
                          : "border-hairline bg-card text-ink/60 hover:text-ink")
                      }
                    >
                      <ArrowDownUp className="size-3.5" />
                      {sortLabel}
                      <ChevronDown className="size-3 opacity-60" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      <DropdownMenuLabel className="text-xs font-normal text-ink/50">
                        Sort by
                      </DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={sort}
                        onValueChange={(v) =>
                          setSearch({ sort: v === "newest" ? undefined : (v as SortKey) })
                        }
                      >
                        {SORT_OPTIONS.map((o) => (
                          <DropdownMenuRadioItem key={o.key} value={o.key}>
                            {o.label}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {filtering && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="h-8 px-1 text-xs font-medium text-brand hover:underline"
                    >
                      Clear filters
                    </button>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <div className="relative flex-1 lg:flex-none">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink/40" />
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setSearch({ q: e.target.value })}
                      placeholder="Search forms"
                      aria-label="Search forms"
                      className="h-8 w-full rounded-md border border-hairline bg-card pl-8 pr-7 text-sm outline-none placeholder:text-ink/40 focus:border-brand/40 focus:ring-2 focus:ring-brand/15 lg:w-44 [&::-webkit-search-cancel-button]:hidden"
                    />
                    {query && (
                      <button
                        type="button"
                        aria-label="Clear search"
                        onClick={() => setSearch({ q: undefined })}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink/40 hover:text-ink"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                  {categories.length > 0 && (
                    <button
                      type="button"
                      aria-pressed={prefs.grouped}
                      onClick={() => updatePrefs({ grouped: !prefs.grouped })}
                      title="Group by category"
                      className={
                        "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors " +
                        (prefs.grouped
                          ? "border-brand/30 bg-brand/[0.07] text-brand"
                          : "border-hairline bg-card text-ink/60 hover:text-ink")
                      }
                    >
                      <Rows3 className="size-3.5" />
                      Group
                    </button>
                  )}
                  <div
                    role="radiogroup"
                    aria-label="Layout"
                    className="inline-flex rounded-md border border-hairline bg-card p-0.5"
                  >
                    {(
                      [
                        { mode: "list", label: "List view", Icon: List },
                        { mode: "grid", label: "Grid view", Icon: LayoutGrid },
                        { mode: "table", label: "Table view", Icon: Table2 },
                      ] as const
                    ).map(({ mode, label, Icon }) => (
                      <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={prefs.view === mode}
                        aria-label={label}
                        title={label}
                        onClick={() => updatePrefs({ view: mode })}
                        className={
                          "rounded p-1.5 transition-colors " +
                          (prefs.view === mode
                            ? "bg-ink text-paper"
                            : "text-ink/50 hover:bg-ink/5 hover:text-ink")
                        }
                      >
                        <Icon className="size-3.5" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4">
            {isLoading && (
              <ul className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-card">
                {Array.from({ length: 3 }).map((_, i) => (
                  <li key={i} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <Skeleton className="h-5 w-1/2" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="mt-3 h-3 w-full" />
                    <Skeleton className="mt-2 h-3 w-2/3" />
                  </li>
                ))}
              </ul>
            )}

            {!isLoading && isError && (
              <div className="flex flex-col items-center rounded-lg border border-dashed border-destructive/30 bg-card px-6 py-14 text-center">
                <FileText className="size-6 text-destructive" strokeWidth={1.5} />
                <h3 className="mt-4 font-display text-2xl">Couldn't load your forms</h3>
                <p className="mt-2 max-w-sm text-sm text-ink/60">
                  Something went wrong fetching your forms. Your forms are safe — this is just a
                  loading issue.
                </p>
                <button
                  type="button"
                  onClick={() => refetchDashboardForms()}
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-md bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground transition-all hover:bg-brand/90"
                >
                  Try again
                </button>
              </div>
            )}

            {!isLoading && !isError && forms.length === 0 && (
              <div className="flex flex-col items-center rounded-lg border border-dashed border-ink/20 bg-card/60 px-6 py-16 text-center">
                <h3 className="font-display text-3xl">No forms yet</h3>
                <p className="mt-2 max-w-sm text-sm text-ink/60">
                  {can.canEdit
                    ? "Start from a template, a blank page, or a one-line goal for Claude."
                    : "Nothing has been created in this workspace yet."}
                </p>
                {can.canEdit && (
                  <Link
                    to="/forms/new"
                    search={isOwnWorkspace ? {} : { ws: ownerId }}
                    className="mt-6 inline-flex items-center justify-center gap-2 rounded-md bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground transition-all hover:bg-brand/90"
                  >
                    <Plus className="size-4" />
                    Create your first form
                  </Link>
                )}
              </div>
            )}

            {!isLoading && !isError && forms.length > 0 && visibleForms.length === 0 && (
              <div className="flex flex-col items-center rounded-lg border border-dashed border-ink/20 bg-card/60 px-6 py-12 text-center">
                <p className="text-sm text-ink/60">No forms match these filters.</p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-3 text-sm font-medium text-brand hover:underline"
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
                    <FormCollection
                      forms={g.forms}
                      view={prefs.view}
                      actions={formActions}
                      sort={sort}
                      onSort={(next) => setSearch({ sort: next === "newest" ? undefined : next })}
                    />
                  </div>
                ))}
              </div>
            )}

            {!isLoading && !isError && visibleForms.length > 0 && !groups && (
              <FormCollection
                forms={visibleForms}
                view={prefs.view}
                actions={formActions}
                sort={sort}
                onSort={(next) => setSearch({ sort: next === "newest" ? undefined : next })}
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
