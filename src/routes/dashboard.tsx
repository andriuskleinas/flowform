import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { ArrowLeft, BarChart3, FileText, LogOut, Pencil, Plus, Share2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "./forms.$formId.edit";

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
  status: "draft" | "published";
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
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

  return <DashboardAuthed userId={user.id} email={user.email ?? ""} signingOutRef={signingOutRef} />;
}

function DashboardAuthed({ userId, email, signingOutRef }: { userId: string; email: string; signingOutRef: React.MutableRefObject<boolean> }) {
  const navigate = useNavigate();

  const { data: forms = [], isLoading } = useQuery({
    queryKey: ["forms", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forms")
        .select("id, title, description, created_at, status")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as FormRow[];
    },
  });

  const { data: responseCounts = {} } = useQuery({
    queryKey: ["response-counts", userId, forms.map((f) => f.id).join(",")],
    enabled: forms.length > 0,
    queryFn: async () => {
      const ids = forms.map((f) => f.id);
      const { data, error } = await supabase
        .from("responses")
        .select("form_id")
        .in("form_id", ids);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        counts[row.form_id] = (counts[row.form_id] ?? 0) + 1;
      }
      return counts;
    },
  });

  const { data: questionCounts = {} } = useQuery({
    queryKey: ["question-counts", userId, forms.map((f) => f.id).join(",")],
    enabled: forms.length > 0,
    queryFn: async () => {
      const ids = forms.map((f) => f.id);
      const { data, error } = await supabase
        .from("questions")
        .select("form_id")
        .in("form_id", ids);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        counts[row.form_id] = (counts[row.form_id] ?? 0) + 1;
      }
      return counts;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const greetingName = profile?.display_name?.trim() || email;

  const handleSignOut = async () => {
    signingOutRef.current = true;
    await supabase.auth.signOut();
    navigate({ to: "/" });
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
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/60 transition-colors hover:text-ink"
            >
              <ArrowLeft className="size-4" />
              Back home
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/60 transition-colors hover:text-ink"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-24 pt-10 md:px-8 md:pt-14">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">Your forms</h1>
          <p className="mt-3 text-base text-ink/60 md:text-lg">
            Welcome, <span className="font-semibold text-ink">{greetingName}</span>.
          </p>
        </div>

        <section aria-labelledby="forms-list-heading" className="mt-10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h2 id="forms-list-heading" className="text-lg font-bold tracking-tight">
                All forms
              </h2>
              {!isLoading && (
                <span className="inline-flex items-center rounded-full bg-ink/5 px-3 py-1 text-xs font-semibold text-ink/70">
                  {count} {count === 1 ? "form" : "forms"}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground transition-all hover:shadow-lg hover:shadow-brand/25"
            >
              <Plus className="size-4" />
              New form
            </button>
          </div>

          <ul className="mt-4 space-y-3">
            {isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="rounded-2xl border border-ink/5 bg-white p-5 shadow-sm md:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <Skeleton className="h-5 w-1/2" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="mt-3 h-3 w-full" />
                  <Skeleton className="mt-2 h-3 w-2/3" />
                </li>
              ))}

            {!isLoading && forms.length === 0 && (
              <li className="flex flex-col items-center rounded-2xl border border-dashed border-ink/15 bg-white/50 px-6 py-14 text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <FileText className="size-7" />
                </span>
                <h3 className="mt-5 text-xl font-bold tracking-tight">No forms yet</h3>
                <p className="mt-2 max-w-sm text-sm text-ink/60">
                  You haven't created any forms yet. Get started below.
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground transition-all hover:shadow-lg hover:shadow-brand/25"
                >
                  <Plus className="size-4" />
                  Create your first form
                </button>
              </li>
            )}

            {!isLoading &&
              forms.map((f) => {
                const rCount = responseCounts[f.id] ?? 0;
                const qCount = questionCounts[f.id] ?? 0;
                const copyShareLink = async () => {
                  const url = `${window.location.origin}/forms/${f.id}`;
                  try {
                    await navigator.clipboard.writeText(url);
                    toast.success("Link copied");
                  } catch {
                    toast.error("Could not copy link");
                  }
                };
                return (
                  <li
                    key={f.id}
                    className="group rounded-2xl border border-ink/5 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md md:p-6"
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
                            <h3 className="truncate text-base font-bold tracking-tight md:text-lg">{f.title}</h3>
                            <StatusPill status={f.status} />
                          </div>
                          {f.description && (
                            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink/60">{f.description}</p>
                          )}
                          <p className="mt-2 text-xs font-medium text-ink/50">
                            {qCount} {qCount === 1 ? "question" : "questions"} · {rCount} {rCount === 1 ? "response" : "responses"} · {timeAgo(f.created_at)}
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
                          onClick={copyShareLink}
                          aria-label="Copy public link"
                          title="Copy public link"
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
                      </div>
                    </div>
                  </li>
                );
              })}
          </ul>
        </section>
      </main>

      <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-transparent data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            className="fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-2xl shadow-ink/20 ring-1 ring-ink/5 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          >
            <div className="flex flex-col space-y-1.5">
              <DialogPrimitive.Title className="text-lg font-semibold leading-none tracking-tight">
                Create a new form
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm text-ink/60">
                Give your form a title, description, and the type of the first question. You can add more questions later.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              className="absolute right-4 top-4 rounded-sm text-ink/50 opacity-70 transition-opacity hover:opacity-100"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (canSubmit) createForm.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="form-title">Title</Label>
                <Input
                  id="form-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Customer feedback Q3"
                  maxLength={120}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="form-description">
                  Description <span className="font-normal text-ink/40">(optional)</span>
                </Label>
                <Textarea
                  id="form-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's this form for?"
                  maxLength={500}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="form-question-type">First question type</Label>
                <select
                  id="form-question-type"
                  value={questionType}
                  onChange={(e) => setQuestionType(e.target.value as QType)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="text">Short answer (text)</option>
                  <option value="multiple_choice">Multiple choice</option>
                  <option value="rating">Rating scale</option>
                </select>
                <p className="text-xs text-ink/50">
                  We'll add an empty question of this type so you can start editing right away.
                </p>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => handleOpenChange(false)}
                  disabled={createForm.isPending}
                  className="inline-flex items-center justify-center rounded-full border border-ink/10 bg-white px-5 py-2.5 text-sm font-semibold text-ink/70 transition-colors hover:bg-ink/5 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground transition-all hover:shadow-lg hover:shadow-brand/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {createForm.isPending ? "Creating…" : "Create form"}
                </button>
              </div>
            </form>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}
