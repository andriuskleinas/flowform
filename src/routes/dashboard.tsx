import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileText,
  LayoutGrid,
  List,
  LogOut,
  Plus,
  Rows3,
  Search,
  Table2,
  User,
  X,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { CategoryDialog } from "@/components/dashboard/category-dialog";
import {
  FormCollection,
  type DashboardForm,
  type FormActionHandlers,
  type ViewMode,
} from "@/components/dashboard/form-collection";
import type { FormStatus } from "@/lib/form-utils";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Flowform" },
      { name: "description", content: "Create and manage your Flowform forms." },
      { property: "og:title", content: "Dashboard — Flowform" },
      { property: "og:description", content: "Create and manage your Flowform forms." },
    ],
  }),
  component: DashboardPage,
});

type FormRow = Pick<DashboardForm, "id" | "title" | "description" | "created_at" | "status">;

const UNCATEGORIZED = "__uncategorized__";
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
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  muted?: boolean;
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
          : "border-hairline bg-white hover:border-ink/25 " +
            (muted ? "text-ink/50 hover:text-ink" : "text-ink/75 hover:text-ink"))
      }
    >
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
    queryKey: ["dashboard-forms", userId],
    // The global 30s staleTime is fine for most queries, but this is the
    // primary landing view for data that changes from other tabs/devices
    // (creating or publishing a form elsewhere doesn't invalidate this
    // query's cache here). Always treat it as stale so window focus and
    // remounts refetch instead of silently showing an outdated list.
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dashboard_forms");
      if (error) throw error;
      // `bigint` columns may come back as strings from PostgREST for very
      // large counts; coerce to numbers so the render path stays simple.
      return (data ?? []).map(
        (r): DashboardForm => ({
          ...r,
          status: r.status as FormStatus,
          category: r.category ?? null,
          last_response_at: r.last_response_at ?? null,
          response_count: Number(r.response_count),
          question_count: Number(r.question_count),
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

  // ---- Category + search filtering --------------------------------------
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of forms) if (f.category) m.set(f.category, (m.get(f.category) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [forms]);
  const categories = useMemo(() => categoryCounts.map(([c]) => c), [categoryCounts]);
  const uncategorizedCount = forms.filter((f) => !f.category).length;

  // A filter pointing at a category that no longer exists falls back to All.
  useEffect(() => {
    if (categoryFilter === null) return;
    const stale =
      categoryFilter === UNCATEGORIZED
        ? uncategorizedCount === 0 || categories.length === 0
        : !categories.includes(categoryFilter);
    if (stale) setCategoryFilter(null);
  }, [categoryFilter, categories, uncategorizedCount]);

  const visibleForms = useMemo(() => {
    const q = query.trim().toLowerCase();
    return forms.filter((f) => {
      if (categoryFilter === UNCATEGORIZED && f.category) return false;
      if (categoryFilter && categoryFilter !== UNCATEGORIZED && f.category !== categoryFilter)
        return false;
      if (!q) return true;
      return (
        f.title.toLowerCase().includes(q) ||
        (f.description ?? "").toLowerCase().includes(q) ||
        (f.category ?? "").toLowerCase().includes(q)
      );
    });
  }, [forms, categoryFilter, query]);

  const groups = useMemo(() => {
    if (!prefs.grouped || categoryFilter !== null || categories.length === 0) return null;
    const out = categories.map((c) => ({
      key: c,
      label: c,
      forms: visibleForms.filter((f) => f.category === c),
    }));
    out.push({
      key: UNCATEGORIZED,
      label: "Uncategorized",
      forms: visibleForms.filter((f) => !f.category),
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
    mutationFn: async ({ formId, category }: { formId: string; category: string | null }) => {
      const { error } = await supabase
        .from("forms")
        .update({ category })
        .eq("id", formId)
        .eq("user_id", userId);
      if (error) throw error;
      return category;
    },
    onSuccess: async (category) => {
      setCategoryTarget(null);
      toast.success(category ? `Moved to “${category}”` : "Category removed");
      await queryClient.invalidateQueries({ queryKey: ["dashboard-forms", userId] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not update category"),
  });

  const duplicateForm = useMutation({
    mutationFn: async (formId: string) => {
      const { data: src, error: srcErr } = await supabase
        .from("forms")
        .select("title, description, display_mode, category")
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
          category: src.category,
          user_id: userId,
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
      await queryClient.invalidateQueries({ queryKey: ["dashboard-forms", userId] });
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
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: async () => {
      setPendingDelete(null);
      toast.success("Form deleted");
      await queryClient.invalidateQueries({ queryKey: ["dashboard-forms", userId] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary", userId] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not delete form"),
  });

  const setFormStatus = useMutation({
    mutationFn: async ({ formId, status }: { formId: string; status: FormStatus }) => {
      const { error } = await supabase
        .from("forms")
        .update({ status })
        .eq("id", formId)
        .eq("user_id", userId);
      if (error) throw error;
      return status;
    },
    onSuccess: async (status) => {
      toast.success(
        status === "closed" ? "Form closed — no longer accepting responses" : "Form reopened",
      );
      await queryClient.invalidateQueries({ queryKey: ["dashboard-forms", userId] });
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
        .eq("user_id", userId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["dashboard-forms", userId] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary", userId] });
      toast.success("Form published");
      const row = dashboardForms.find((f) => f.id === formId);
      if (row) setShareTarget({ ...row, status: "published" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish form");
    }
  };

  const formActions: FormActionHandlers = {
    onShare: (f) => (f.status === "draft" ? setPendingPublish(f.id) : setShareTarget(f)),
    onDuplicate: (f) => duplicateForm.mutate(f.id),
    onSetStatus: (f, status) => setFormStatus.mutate({ formId: f.id, status }),
    onCategory: (f) => setCategoryTarget(f),
    onDelete: (f) => setPendingDelete(f),
    duplicatePending: duplicateForm.isPending,
  };

  const filtering = categoryFilter !== null || query.trim() !== "";

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
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl md:text-5xl">Your forms</h1>
          <p className="mt-3 text-base text-ink/60">
            Welcome back, <span className="text-ink">{greetingName}</span>.
          </p>
        </div>

        {!isError && (forms.length > 0 || isLoading) && (
          <DashboardSummaryPanel userId={userId} forms={forms} formsLoading={isLoading} />
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
            <Link
              to="/forms/new"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-ink px-3.5 text-sm font-medium text-paper transition-colors hover:bg-ink/85"
            >
              <Plus className="size-4" />
              New form
            </Link>
          </div>

          {!isLoading && !isError && forms.length > 0 && (
            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div
                role="tablist"
                aria-label="Filter by category"
                className="-mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1 pb-1 md:pb-0"
              >
                <CategoryChip
                  active={categoryFilter === null}
                  onClick={() => setCategoryFilter(null)}
                  label="All"
                  count={forms.length}
                />
                {categoryCounts.map(([c, n]) => (
                  <CategoryChip
                    key={c}
                    active={categoryFilter === c}
                    onClick={() => setCategoryFilter(c)}
                    label={c}
                    count={n}
                  />
                ))}
                {categories.length > 0 && uncategorizedCount > 0 && (
                  <CategoryChip
                    active={categoryFilter === UNCATEGORIZED}
                    onClick={() => setCategoryFilter(UNCATEGORIZED)}
                    label="Uncategorized"
                    count={uncategorizedCount}
                    muted
                  />
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink/40" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search forms"
                    aria-label="Search forms"
                    className="h-8 w-full rounded-md border border-hairline bg-white pl-8 pr-7 text-sm outline-none placeholder:text-ink/40 focus:border-brand/40 focus:ring-2 focus:ring-brand/15 md:w-44 [&::-webkit-search-cancel-button]:hidden"
                  />
                  {query && (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => setQuery("")}
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
                        : "border-hairline bg-white text-ink/60 hover:text-ink")
                    }
                  >
                    <Rows3 className="size-3.5" />
                    Group
                  </button>
                )}
                <div
                  role="radiogroup"
                  aria-label="Layout"
                  className="inline-flex rounded-md border border-hairline bg-white p-0.5"
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
          )}

          <div className="mt-4">
            {isLoading && (
              <ul className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-white">
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
              <div className="flex flex-col items-center rounded-lg border border-dashed border-destructive/30 bg-white px-6 py-14 text-center">
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
              <div className="flex flex-col items-center rounded-lg border border-dashed border-ink/20 bg-white/60 px-6 py-16 text-center">
                <h3 className="font-display text-3xl">No forms yet</h3>
                <p className="mt-2 max-w-sm text-sm text-ink/60">
                  Start from a template, a blank page, or a one-line goal for Claude.
                </p>
                <Link
                  to="/forms/new"
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-md bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground transition-all hover:bg-brand/90"
                >
                  <Plus className="size-4" />
                  Create your first form
                </Link>
              </div>
            )}

            {!isLoading && !isError && forms.length > 0 && visibleForms.length === 0 && (
              <div className="flex flex-col items-center rounded-lg border border-dashed border-ink/20 bg-white/60 px-6 py-12 text-center">
                <p className="text-sm text-ink/60">No forms match these filters.</p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setCategoryFilter(null);
                  }}
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
                    <div className="mb-2.5 flex items-baseline gap-2">
                      <h3
                        className={
                          "text-sm font-medium " + (g.key === UNCATEGORIZED ? "text-ink/50" : "")
                        }
                      >
                        {g.label}
                      </h3>
                      <span className="font-mono text-[11px] text-ink/40">{g.forms.length}</span>
                    </div>
                    <FormCollection forms={g.forms} view={prefs.view} actions={formActions} />
                  </div>
                ))}
              </div>
            )}

            {!isLoading && !isError && visibleForms.length > 0 && !groups && (
              <FormCollection forms={visibleForms} view={prefs.view} actions={formActions} />
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
        formTitle={categoryTarget?.title ?? ""}
        current={categoryTarget?.category ?? null}
        categories={categories}
        pending={setCategory.isPending}
        onSave={(category) =>
          categoryTarget && setCategory.mutate({ formId: categoryTarget.id, category })
        }
        onCancel={() => setCategoryTarget(null)}
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
