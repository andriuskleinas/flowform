import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Flowform" },
      {
        name: "description",
        content: "Create and manage your Flowform forms.",
      },
      { property: "og:title", content: "Dashboard — Flowform" },
      {
        property: "og:description",
        content: "Create and manage your Flowform forms.",
      },
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
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const { data: forms = [], isLoading } = useQuery({
    queryKey: ["forms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forms")
        .select("id, title, description, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as FormRow[];
    },
  });

  const createForm = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("forms").insert({
        title: title.trim(),
        description: description.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Form saved");
      setTitle("");
      setDescription("");
      qc.invalidateQueries({ queryKey: ["forms"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not save form");
    },
  });

  const canSubmit = title.trim().length > 0 && !createForm.isPending;

  return (
    <div className="min-h-screen bg-surface text-ink">
      <header>
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6 md:px-8">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand">
              <span className="size-3 rounded-sm bg-white" />
            </span>
            <span className="text-xl font-bold tracking-tight">Flowform</span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/60 transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-4" />
            Back home
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-8 md:px-8 md:pt-12">
        <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">
          Your forms
        </h1>
        <p className="mt-3 text-base text-ink/60 md:text-lg">
          Create a form, then watch it appear in the list below.
        </p>

        <section
          aria-labelledby="create-form-heading"
          className="mt-10 rounded-2xl border border-ink/5 bg-white p-6 shadow-sm md:p-8"
        >
          <h2 id="create-form-heading" className="text-lg font-bold tracking-tight">
            New form
          </h2>
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
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Customer feedback Q3"
                maxLength={120}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="form-description">
                Description{" "}
                <span className="font-normal text-ink/40">(optional)</span>
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
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground transition-all hover:shadow-lg hover:shadow-brand/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createForm.isPending ? "Saving…" : "Save form"}
              </button>
            </div>
          </form>
        </section>

        <section aria-labelledby="forms-list-heading" className="mt-12">
          <h2
            id="forms-list-heading"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50"
          >
            All forms {forms.length > 0 && `(${forms.length})`}
          </h2>

          <ul className="mt-4 space-y-3">
            {isLoading && (
              <li className="rounded-2xl border border-ink/5 bg-white p-6 text-sm text-ink/50">
                Loading…
              </li>
            )}
            {!isLoading && forms.length === 0 && (
              <li className="rounded-2xl border border-dashed border-ink/15 bg-white/50 p-8 text-center text-sm text-ink/50">
                No forms yet — create your first one above.
              </li>
            )}
            {forms.map((f) => (
              <li
                key={f.id}
                className="rounded-2xl border border-ink/5 bg-white p-5 shadow-sm transition-shadow hover:shadow-md md:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-base font-bold tracking-tight md:text-lg">
                    {f.title}
                  </h3>
                  <span className="shrink-0 text-xs text-ink/40">
                    {timeAgo(f.created_at)}
                  </span>
                </div>
                {f.description && (
                  <p className="mt-2 text-sm leading-relaxed text-ink/60">
                    {f.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
