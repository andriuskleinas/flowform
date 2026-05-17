import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { BarChart3, FileText, Home, LogOut, Pencil, Plus, Share2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/status-pill";

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

const PUBLIC_SITE_ORIGIN = "https://flowformapp.lovable.app";

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
  const queryClient = useQueryClient();

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
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Open account menu"
              className="flex size-9 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand outline-none transition-all hover:bg-brand/15 focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              {getInitials(profile?.display_name, email)}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="px-2 py-2">
                <p className="truncate text-sm font-semibold text-ink">
                  {profile?.display_name?.trim() || "Account"}
                </p>
                <p className="truncate text-xs text-ink/60">{email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ to: "/" })}>
                <Home className="size-4" />
                Home
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/forms/new" })}>
                <Plus className="size-4" />
                New form
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
              {!isLoading && (
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

            {!isLoading && forms.length === 0 && (
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
              forms.map((f) => {
                const rCount = responseCounts[f.id] ?? 0;
                const qCount = questionCounts[f.id] ?? 0;
                const isPublished = f.status === "published";
                const copyShareLink = async () => {
                  const url = `${PUBLIC_SITE_ORIGIN}/forms/${f.id}`;
                  try {
                    if (!isPublished) {
                      const { error } = await supabase
                        .from("forms")
                        .update({ status: "published" })
                        .eq("id", f.id)
                        .eq("user_id", userId);
                      if (error) throw error;
                      await queryClient.invalidateQueries({ queryKey: ["forms", userId] });
                    }
                    await navigator.clipboard.writeText(url);
                    toast.success(isPublished ? "Link copied" : "Form published and link copied");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Could not copy link");
                  }
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
                          aria-label={isPublished ? "Copy public link" : "Publish and copy public link"}
                          title={isPublished ? "Copy public link" : "Publish and copy public link"}
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

    </div>
  );
}
