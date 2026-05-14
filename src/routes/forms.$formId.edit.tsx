import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowDown, ArrowUp, ExternalLink, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QuestionRender, type Question, type QuestionType } from "@/components/question-render";

export const Route = createFileRoute("/forms/$formId/edit")({
  component: EditFormPage,
});

function EditFormPage() {
  const { formId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", search: { redirect: `/forms/${formId}/edit` } });
  }, [loading, user, navigate, formId]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-surface p-10">
        <Skeleton className="h-10 w-64" />
      </div>
    );
  }

  return <EditFormAuthed formId={formId} userId={user.id} />;
}

function EditFormAuthed({ formId, userId }: { formId: string; userId: string }) {
  const qc = useQueryClient();

  const formQ = useQuery({
    queryKey: ["form", formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forms")
        .select("id, title, description, user_id, status")
        .eq("id", formId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const questionsQ = useQuery({
    queryKey: ["questions", formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("id, form_id, type, label, options, position")
        .eq("form_id", formId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Question[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["questions", formId] });
    qc.invalidateQueries({ queryKey: ["public-questions", formId] });
  };

  const addQuestion = useMutation({
    mutationFn: async (type: QuestionType) => {
      const list = questionsQ.data ?? [];
      const position = list.length;
      const defaults: Record<QuestionType, { label: string; options: any }> = {
        text: { label: "Untitled question", options: null },
        multiple_choice: { label: "Untitled question", options: ["Option 1", "Option 2"] },
        rating: { label: "Untitled question", options: { max: 5 } },
      };
      const { error } = await supabase.from("questions").insert({
        form_id: formId,
        type,
        label: defaults[type].label,
        options: defaults[type].options,
        position,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const updateQuestion = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Question> }) => {
      const { error } = await supabase.from("questions").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteQuestion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("questions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const swap = useMutation({
    mutationFn: async ({ a, b }: { a: Question; b: Question }) => {
      // Two-step swap to avoid unique-position issues (no constraint here, but safe pattern)
      const { error: e1 } = await supabase
        .from("questions")
        .update({ position: b.position })
        .eq("id", a.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("questions")
        .update({ position: a.position })
        .eq("id", b.id);
      if (e2) throw e2;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePublish = useMutation({
    mutationFn: async (next: "draft" | "published") => {
      const { error } = await supabase.from("forms").update({ status: next }).eq("id", formId);
      if (error) throw error;
    },
    onSuccess: (_d, next) => {
      toast.success(next === "published" ? "Form published" : "Moved back to draft");
      qc.invalidateQueries({ queryKey: ["form", formId] });
      qc.invalidateQueries({ queryKey: ["forms"] });
      qc.invalidateQueries({ queryKey: ["public-form", formId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (formQ.isLoading) {
    return (
      <Shell>
        <Skeleton className="h-10 w-64" />
      </Shell>
    );
  }

  if (!formQ.data || formQ.data.user_id !== userId) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold">Form not found</h1>
        <p className="mt-2 text-ink/60">It may have been deleted, or you don't have access.</p>
        <Link to="/dashboard" className="mt-6 inline-block text-brand underline">
          Back to dashboard
        </Link>
      </Shell>
    );
  }

  const form = formQ.data;
  const questions = questionsQ.data ?? [];
  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/forms/${formId}` : "";

  return (
    <Shell>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/60 hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Back to dashboard
        </Link>
        <a
          href={publicUrl}
          target="_blank"
          rel="noreferrer"
          title="Opens the page respondents see in a new tab"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/60 hover:text-ink"
        >
          <ExternalLink className="size-4" /> Preview public form
        </a>
      </div>

      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{form.title}</h1>
          <StatusPill status={form.status as "draft" | "published"} />
        </div>
        {form.description && <p className="mt-2 text-ink/60">{form.description}</p>}
        <div className="mt-4">
          {form.status === "published" ? (
            <button
              type="button"
              onClick={() => togglePublish.mutate("draft")}
              disabled={togglePublish.isPending}
              className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-ink/5 disabled:opacity-50"
            >
              Unpublish
            </button>
          ) : (
            <button
              type="button"
              onClick={() => togglePublish.mutate("published")}
              disabled={togglePublish.isPending || questions.length === 0}
              title={questions.length === 0 ? "Add at least one question first" : undefined}
              className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:shadow-lg hover:shadow-brand/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Publish form
            </button>
          )}
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Editor */}
        <section>
          <h2 className="text-lg font-bold">Questions</h2>
          <ul className="mt-4 space-y-4">
            {questions.map((q, i) => (
              <li key={q.id} className="rounded-2xl border border-ink/5 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">
                    {labelForType(q.type)}
                  </span>
                  <div className="flex items-center gap-1">
                    <IconBtn
                      label="Move up"
                      onClick={() => i > 0 && swap.mutate({ a: q, b: questions[i - 1] })}
                      disabled={i === 0}
                    >
                      <ArrowUp className="size-4" />
                    </IconBtn>
                    <IconBtn
                      label="Move down"
                      onClick={() =>
                        i < questions.length - 1 && swap.mutate({ a: q, b: questions[i + 1] })
                      }
                      disabled={i === questions.length - 1}
                    >
                      <ArrowDown className="size-4" />
                    </IconBtn>
                    <IconBtn label="Delete" onClick={() => deleteQuestion.mutate(q.id)}>
                      <Trash2 className="size-4" />
                    </IconBtn>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Question</Label>
                    <Input
                      defaultValue={q.label}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== q.label) updateQuestion.mutate({ id: q.id, patch: { label: v } });
                      }}
                    />
                  </div>

                  {q.type === "multiple_choice" && (
                    <OptionsEditor
                      options={Array.isArray(q.options) ? q.options : []}
                      onChange={(options) => updateQuestion.mutate({ id: q.id, patch: { options } })}
                    />
                  )}

                  {q.type === "rating" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Max rating</Label>
                      <select
                        value={q.options?.max ?? 5}
                        onChange={(e) =>
                          updateQuestion.mutate({
                            id: q.id,
                            patch: { options: { max: Number(e.target.value) } },
                          })
                        }
                        className="rounded-md border border-input bg-transparent px-3 py-1.5 text-sm"
                      >
                        {[3, 5, 7, 10].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground hover:shadow-lg hover:shadow-brand/25"
                >
                  <Plus className="size-4" /> Add question
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => addQuestion.mutate("text")}>
                  Short answer
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addQuestion.mutate("multiple_choice")}>
                  Multiple choice
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addQuestion.mutate("rating")}>
                  Rating scale
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </section>

        {/* Preview */}
        <section className="lg:sticky lg:top-6 lg:self-start">
          <h2 className="text-lg font-bold">Preview</h2>
          <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
            <h3 className="text-2xl font-extrabold tracking-tight">{form.title}</h3>
            {form.description && <p className="mt-2 text-sm text-ink/60">{form.description}</p>}
            <div className="mt-6 space-y-6">
              {questions.length === 0 && (
                <p className="text-sm text-ink/40">No questions yet — add one to see a preview.</p>
              )}
              {questions.map((q) => (
                <QuestionRender key={q.id} question={q} value={undefined} disabled />
              ))}
            </div>
          </div>
        </section>
      </div>
    </Shell>
  );
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState(options);
  useEffect(() => setDraft(options), [options.join("\u0001")]);

  const commit = (next: string[]) => {
    setDraft(next);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs">Options</Label>
      {draft.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={opt}
            onChange={(e) => setDraft(draft.map((o, j) => (j === i ? e.target.value : o)))}
            onBlur={() => onChange(draft)}
          />
          <button
            type="button"
            onClick={() => commit(draft.filter((_, j) => j !== i))}
            className="rounded p-2 text-ink/50 hover:bg-ink/5"
            aria-label="Remove option"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => commit([...draft, `Option ${draft.length + 1}`])}
        className="text-sm font-medium text-brand hover:underline"
      >
        + Add option
      </button>
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded p-1.5 text-ink/60 hover:bg-ink/5 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function labelForType(t: QuestionType) {
  return t === "text" ? "Short answer" : t === "multiple_choice" ? "Multiple choice" : "Rating";
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <main className="mx-auto max-w-6xl px-6 py-10 md:px-8 md:py-14">{children}</main>
    </div>
  );
}

export function StatusPill({ status }: { status: "draft" | "published" }) {
  if (status === "published") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
        <span className="size-1.5 rounded-full bg-emerald-500" /> Published live
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/10 px-2.5 py-0.5 text-xs font-semibold text-ink/60">
      <span className="size-1.5 rounded-full bg-ink/40" /> Draft
    </span>
  );
}
