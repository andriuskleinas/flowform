import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  CircleSlash,
  CirclePlay,
  CopyPlus,
  FileText,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  Share2,
  Trash2,
  User,
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
import { StatusPill } from "@/components/status-pill";
import { getInitialsFromProfile, timeAgo } from "@/lib/utils";
import type { FormStatus } from "@/lib/form-utils";

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

type FormRow = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  status: FormStatus;
};

/** Row shape returned by the `get_dashboard_forms` Postgres RPC. */
type DashboardFormRow = FormRow & {
  response_count: number;
  question_count: number;
};

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
      return (data ?? []).map((r) => ({
        ...r,
        status: r.status as FormStatus,
        response_count: Number(r.response_count),
        question_count: Number(r.question_count),
      }));
    },
  });

  const forms: FormRow[] = dashboardForms;
  const responseCounts: Record<string, number> = Object.fromEntries(
    dashboardForms.map((f) => [f.id, f.response_count]),
  );
  const questionCounts: Record<string, number> = Object.fromEntries(
    dashboardForms.map((f) => [f.id, f.question_count]),
  );

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
  const [pendingDelete, setPendingDelete] = useState<DashboardFormRow | null>(null);
  const [shareTarget, setShareTarget] = useState<FormRow | null>(null);

  const duplicateForm = useMutation({
    mutationFn: async (formId: string) => {
      const { data: src, error: srcErr } = await supabase
        .from("forms")
        .select("title, description, display_mode")
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
      toast.success("Form published");
      const row = dashboardForms.find((f) => f.id === formId);
      if (row) setShareTarget({ ...row, status: "published" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish form");
    }
  };

  return (
    <div className="min-h-screen bg-surface text-ink">
      <header className="border-b border-ink/5">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 md:px-8">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand">
              <span className="size-3 rounded-sm bg-white" />
            </span>
            <span className="text-xl font-bold tracking-tight">Flowform</span>
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

      <main className="mx-auto max-w-4xl px-6 pb-24 pt-10 md:px-8 md:pt-14">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">Your forms</h1>
          <p className="mt-3 text-base text-ink/60 md:text-lg">
            Welcome, <span className="font-semibold text-ink">{greetingName}</span>.
          </p>
        </div>

        <section aria-labelledby="forms-list-heading" className="mt-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h2 id="forms-list-heading" className="text-lg font-bold tracking-tight">
                All forms
              </h2>
              {!isLoading && !isError && (
                <span className="inline-flex items-center rounded-full bg-ink/5 px-3 py-1 text-xs font-semibold text-ink/70">
                  {forms.length} {forms.length === 1 ? "form" : "forms"}
                </span>
              )}
            </div>
            <Link
              to="/forms/new"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground transition-all hover:shadow-lg hover:shadow-brand/25"
            >
              <Plus className="size-4" />
              New form
            </Link>
          </div>

          <ul className="mt-4 space-y-3">
            {isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="rounded-2xl border border-ink/5 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <Skeleton className="h-5 w-1/2" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="mt-3 h-3 w-full" />
                  <Skeleton className="mt-2 h-3 w-2/3" />
                </li>
              ))}

            {!isLoading && isError && (
              <li className="flex flex-col items-center rounded-2xl border border-dashed border-red-200 bg-red-50/50 px-6 py-14 text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <FileText className="size-7" />
                </span>
                <h3 className="mt-5 text-xl font-bold tracking-tight">Couldn't load your forms</h3>
                <p className="mt-2 max-w-sm text-sm text-ink/60">
                  Something went wrong fetching your forms. Your forms are safe — this is just a
                  loading issue.
                </p>
                <button
                  type="button"
                  onClick={() => refetchDashboardForms()}
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground transition-all hover:shadow-lg hover:shadow-brand/25"
                >
                  Try again
                </button>
              </li>
            )}

            {!isLoading && !isError && forms.length === 0 && (
              <li className="flex flex-col items-center rounded-2xl border border-dashed border-ink/15 bg-white/50 px-6 py-14 text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <FileText className="size-7" />
                </span>
                <h3 className="mt-5 text-xl font-bold tracking-tight">No forms yet</h3>
                <p className="mt-2 max-w-sm text-sm text-ink/60">
                  You haven't created any forms yet. Get started below.
                </p>
                <Link
                  to="/forms/new"
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground transition-all hover:shadow-lg hover:shadow-brand/25"
                >
                  <Plus className="size-4" />
                  Create your first form
                </Link>
              </li>
            )}

            {!isLoading &&
              !isError &&
              forms.map((f) => {
                const rCount = responseCounts[f.id] ?? 0;
                const qCount = questionCounts[f.id] ?? 0;
                const isDraft = f.status === "draft";
                const openShare = () => {
                  if (isDraft) {
                    setPendingPublish(f.id);
                    return;
                  }
                  setShareTarget(f);
                };
                return (
                  <li
                    key={f.id}
                    className="group rounded-2xl border border-ink/5 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <Link
                        to="/forms/$formId/edit"
                        params={{ formId: f.id }}
                        className="flex min-w-0 flex-1 items-start gap-3"
                      >
                        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                          <FileText className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-base font-bold tracking-tight md:text-lg">
                              {f.title}
                            </h3>
                            <StatusPill status={f.status} />
                          </div>
                          {f.description && (
                            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink/60">
                              {f.description}
                            </p>
                          )}
                          <p className="mt-2 text-xs font-medium text-ink/50">
                            {qCount} {qCount === 1 ? "question" : "questions"} · {rCount}{" "}
                            {rCount === 1 ? "response" : "responses"} · {timeAgo(f.created_at)}
                          </p>
                        </div>
                      </Link>
                      <div className="flex shrink-0 items-center gap-1">
                        <Link
                          to="/forms/$formId/edit"
                          params={{ formId: f.id }}
                          aria-label="Edit form"
                          title="Edit"
                          className="rounded-lg p-2 text-ink/60 hover:bg-ink/5 hover:text-ink"
                        >
                          <Pencil className="size-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={openShare}
                          aria-label={isDraft ? "Publish and share" : "Share form"}
                          title={isDraft ? "Publish and share" : "Share"}
                          className="rounded-lg p-2 text-ink/60 hover:bg-ink/5 hover:text-ink"
                        >
                          <Share2 className="size-4" />
                        </button>
                        <Link
                          to="/forms/$formId/responses"
                          params={{ formId: f.id }}
                          aria-label="View responses"
                          title="View responses"
                          className="rounded-lg p-2 text-ink/60 hover:bg-ink/5 hover:text-ink"
                        >
                          <BarChart3 className="size-4" />
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            aria-label="More actions"
                            title="More actions"
                            className="rounded-lg p-2 text-ink/60 outline-none hover:bg-ink/5 hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/40"
                          >
                            <MoreHorizontal className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem
                              disabled={duplicateForm.isPending}
                              onClick={() => duplicateForm.mutate(f.id)}
                            >
                              <CopyPlus className="size-4" />
                              Duplicate form
                            </DropdownMenuItem>
                            {f.status === "published" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  setFormStatus.mutate({ formId: f.id, status: "closed" })
                                }
                              >
                                <CircleSlash className="size-4" />
                                Close form
                              </DropdownMenuItem>
                            )}
                            {f.status === "closed" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  setFormStatus.mutate({ formId: f.id, status: "published" })
                                }
                              >
                                <CirclePlay className="size-4" />
                                Reopen form
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                setPendingDelete(dashboardForms.find((d) => d.id === f.id) ?? null)
                              }
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="size-4" />
                              Delete form
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </li>
                );
              })}
          </ul>
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

      <ShareFormDialog
        open={shareTarget !== null}
        onOpenChange={(open) => !open && setShareTarget(null)}
        formId={shareTarget?.id ?? ""}
        formTitle={shareTarget?.title ?? ""}
      />
    </div>
  );
}
