import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, FileText, LogOut } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

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

  useEffect(() => {
    if (!authLoading && !user) {
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

  return <DashboardAuthed userId={user.id} email={user.email ?? ""} />;
}

function DashboardAuthed({ userId, email }: { userId: string; email: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  const focusCreate = () => {
    titleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    titleRef.current?.focus({ preventScroll: true });
  };


  const { data: forms = [], isLoading } = useQuery({
    queryKey: ["forms", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forms")
        .select("id, title, description, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as FormRow[];
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


  const createForm = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("forms").insert({
        title: title.trim(),
        description: description.trim() || null,
        user_id: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Form saved");
      setTitle("");
      setDescription("");
      qc.invalidateQueries({ queryKey: ["forms", userId] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not save form");
    },
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  const canSubmit = title.trim().length > 0 && !createForm.isPending;
  const count = forms.length;

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

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-10 md:px-8 md:pt-14">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">Your forms</h1>
          <p className="mt-3 text-base text-ink/60 md:text-lg">
            Welcome, <span className="font-semibold text-ink">{greetingName}</span>. Create a form on the left, then watch it appear in the list.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-10">
          <section aria-labelledby="create-form-heading" className="md:col-span-1">
            <div className="rounded-2xl border border-ink/5 bg-white p-6 shadow-sm md:sticky md:top-8">
              <h2 id="create-form-heading" className="text-lg font-bold tracking-tight">New form</h2>
              <form
                className="mt-5 space-y-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (canSubmit) createForm.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="form-title">Title</Label>
                  <Input
                    id="form-title"
                    ref={titleRef}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Customer feedback Q3"
                    maxLength={120}
                    required
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
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground transition-all hover:shadow-lg hover:shadow-brand/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {createForm.isPending ? "Saving…" : "Save form"}
                </button>
              </form>
            </div>
          </section>

          <section aria-labelledby="forms-list-heading" className="md:col-span-2">
            <div className="flex items-center justify-between">
              <h2 id="forms-list-heading" className="text-lg font-bold tracking-tight">All forms</h2>
              {!isLoading && (
                <span className="inline-flex items-center rounded-full bg-ink/5 px-3 py-1 text-xs font-semibold text-ink/70">
                  {count} {count === 1 ? "form" : "forms"}
                </span>
              )}
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
                    onClick={focusCreate}
                    className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground transition-all hover:shadow-lg hover:shadow-brand/25"
                  >
                    Create your first form
                  </button>
                </li>
              )}

              {!isLoading &&
                forms.map((f) => (
                  <li
                    key={f.id}
                    className="group rounded-2xl border border-ink/5 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md md:p-6"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                          <FileText className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-bold tracking-tight md:text-lg">{f.title}</h3>
                          {f.description && (
                            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink/60">{f.description}</p>
                          )}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-ink/40">{timeAgo(f.created_at)}</span>
                    </div>
                  </li>
                ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
