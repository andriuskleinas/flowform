import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useTransition } from "react";
import { ArrowLeft, Loader2, Plus, Sparkles, Trash2, WandSparkles, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { suggestQuestions, type SuggestedQuestion } from "@/lib/suggest-questions";
import { useAuth } from "@/hooks/use-auth";
import { type QuestionType, type QuestionOptions, RATING_MAX_CHOICES } from "@/lib/form-utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

type DraftQuestion = {
  key: string;
  type: QuestionType;
  label: string;
  options: QuestionOptions;
};

export const Route = createFileRoute("/forms/new")({
  head: () => ({
    meta: [
      { title: "Create a new form — Flowform" },
      { name: "description", content: "Build a new Flowform questionnaire." },
    ],
  }),
  component: NewFormPage,
});

function defaultOptions(type: QuestionType): QuestionOptions {
  if (type === "multiple_choice") return ["Option 1", "Option 2"];
  if (type === "rating") return { max: 5 };
  return null;
}

function makeQuestion(): DraftQuestion {
  return {
    key: crypto.randomUUID(),
    type: "text",
    label: "",
    options: null,
  };
}

function NewFormPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", search: { redirect: "/forms/new" } });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-surface p-10">
        <Skeleton className="h-10 w-64" />
      </div>
    );
  }

  return <NewFormAuthed userId={user.id} />;
}

function NewFormAuthed({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([makeQuestion()]);

  const [suggestions, setSuggestions] = useState<SuggestedQuestion[]>([]);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [isSuggesting, startSuggesting] = useTransition();
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const handleSuggest = () => {
    setSuggestError(null);
    startSuggesting(async () => {
      try {
        const results = await suggestQuestions({ data: { title, description } });
        setSuggestions(results);
        setAddedIds(new Set());
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Could not get suggestions. Please try again.";
        setSuggestError(message);
      }
    });
  };

  const addSuggestion = (s: SuggestedQuestion) => {
    setQuestions((qs) => {
      const newQ = { key: crypto.randomUUID(), type: s.type, label: s.label, options: s.options };
      // If the only question is the default empty placeholder, replace it rather
      // than appending — so the AI flow doesn't leave a blank question behind.
      if (qs.length === 1 && qs[0].label.trim() === "") return [newQ];
      return [...qs, newQ];
    });
    setAddedIds((prev) => new Set(prev).add(s.id));
  };

  const updateQuestion = (key: string, patch: Partial<DraftQuestion>) => {
    setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  };

  const addQuestion = () => setQuestions((qs) => [...qs, makeQuestion()]);

  const removeQuestion = (key: string) =>
    setQuestions((qs) => (qs.length === 1 ? qs : qs.filter((q) => q.key !== key)));

  const createForm = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Title is required");
      for (const q of questions) {
        if (!q.label.trim()) throw new Error("Every question needs a label");
        if (q.type === "multiple_choice") {
          const opts = (q.options as string[]).map((o) => o.trim()).filter(Boolean);
          if (opts.length < 2) throw new Error("Multiple-choice questions need at least 2 options");
        }
      }

      const { data: form, error: fErr } = await supabase
        .from("forms")
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          user_id: userId,
        })
        .select("id")
        .single();
      if (fErr) throw fErr;
      const newId = form.id as string;

      const rows = questions.map((q, i) => ({
        form_id: newId,
        type: q.type,
        label: q.label.trim(),
        options:
          q.type === "multiple_choice"
            ? (q.options as string[]).map((o) => o.trim()).filter(Boolean)
            : q.options,
        position: i,
      }));
      const { error: qErr } = await supabase.from("questions").insert(rows);
      if (qErr) throw qErr;

      return newId;
    },
    onSuccess: (newId) => {
      toast.success("Form created");
      qc.invalidateQueries({ queryKey: ["forms", userId] });
      qc.invalidateQueries({ queryKey: ["dashboard-forms", userId] });
      navigate({ to: "/forms/$formId/edit", params: { formId: newId } });
    },
    onError: (err: Error) => toast.error(err.message || "Could not save form"),
  });

  const canSubmit = title.trim().length > 0 && !createForm.isPending;

  return (
    <div className="min-h-screen bg-surface text-ink">
      <header className="border-b border-ink/5">
        <nav className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6 md:px-8">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand">
              <span className="size-3 rounded-sm bg-white" />
            </span>
            <span className="text-xl font-bold tracking-tight">Flowform</span>
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/60 transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-4" />
            Dashboard
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-10 md:px-8 md:pt-14">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">Create a new form</h1>
          <p className="mt-3 text-base text-ink/60 md:text-lg">
            Add a title, a short description, and your questions. You can add as many as you need.
          </p>
        </div>

        <form
          className="mt-10 space-y-6"
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) createForm.mutate();
          }}
        >
          {/* Form details */}
          <section className="rounded-2xl border border-ink/5 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold tracking-tight">Form details</h2>
            <div className="mt-5 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="form-title">Questionnaire title</Label>
                <Input
                  id="form-title"
                  name="questionnaire-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Customer feedback Q3"
                  maxLength={120}
                  required
                  autoFocus
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="form-description">
                  Description <span className="font-normal text-ink/40">(optional)</span>
                </Label>
                <Textarea
                  id="form-description"
                  name="questionnaire-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's this form for?"
                  maxLength={500}
                  rows={3}
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                />
              </div>
            </div>
          </section>

          {/* AI Suggest Questions */}
          <section className="rounded-2xl border border-ink/5 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-1.5 text-lg font-bold tracking-tight">
                  <Sparkles className="size-4 text-brand" />
                  Suggest questions with AI
                </h2>
                <p className="mt-0.5 text-xs text-ink/50">
                  Based on your form title and description
                </p>
              </div>
              <button
                type="button"
                onClick={handleSuggest}
                disabled={isSuggesting || !title.trim()}
                title={!title.trim() ? "Add a title first" : undefined}
                className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-all hover:shadow-lg hover:shadow-brand/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSuggesting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Thinking…
                  </>
                ) : (
                  <>
                    <WandSparkles className="size-4" />
                    Suggest questions
                  </>
                )}
              </button>
            </div>

            {suggestError && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {suggestError}
              </p>
            )}

            {suggestions.length > 0 && (
              <ul className="mt-4 space-y-2">
                {suggestions.map((s) => {
                  const added = addedIds.has(s.id);
                  return (
                    <li
                      key={s.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-ink/10 bg-surface/40 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug text-ink">{s.label}</p>
                        <p className="mt-0.5 text-xs text-ink/50">
                          {s.type === "text" && "Short answer"}
                          {s.type === "multiple_choice" && "Multiple choice"}
                          {s.type === "rating" &&
                            `Rating scale (1–${(s.options as { max: number })?.max ?? 5})`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addSuggestion(s)}
                        disabled={added}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-brand hover:bg-brand/5 hover:text-brand disabled:cursor-default disabled:border-ink/5 disabled:text-ink/30"
                      >
                        {added ? (
                          "Added"
                        ) : (
                          <>
                            <Plus className="size-3" />
                            Add
                          </>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Questions */}
          <section className="rounded-2xl border border-ink/5 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold tracking-tight">Questions</h2>
              <span className="inline-flex items-center rounded-full bg-ink/5 px-3 py-1 text-xs font-semibold text-ink/70">
                {questions.length}
              </span>
            </div>

            <ul className="mt-5 space-y-4">
              {questions.map((q, i) => {
                const mcOpts = Array.isArray(q.options) ? (q.options as string[]) : [];
                const ratingMax =
                  q.type === "rating" && q.options && !Array.isArray(q.options)
                    ? (q.options as { max: number }).max
                    : 5;
                return (
                  <li key={q.key} className="rounded-xl border border-ink/10 bg-surface/40 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="mt-2 text-xs font-semibold uppercase tracking-wide text-ink/50">
                        Question {i + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeQuestion(q.key)}
                        disabled={questions.length === 1}
                        aria-label="Remove question"
                        className="rounded-lg p-2 text-ink/50 hover:bg-ink/5 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>

                    <div className="mt-2 grid gap-3 md:grid-cols-[1fr_220px]">
                      <div className="space-y-2">
                        <Label htmlFor={`q-${q.key}-label`}>Question</Label>
                        <Input
                          id={`q-${q.key}-label`}
                          value={q.label}
                          onChange={(e) => updateQuestion(q.key, { label: e.target.value })}
                          placeholder="Type your question…"
                          maxLength={300}
                          autoComplete="off"
                          data-1p-ignore
                          data-lpignore="true"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`q-${q.key}-type`}>Type</Label>
                        <select
                          id={`q-${q.key}-type`}
                          value={q.type}
                          onChange={(e) => {
                            const next = e.target.value as QuestionType;
                            updateQuestion(q.key, { type: next, options: defaultOptions(next) });
                          }}
                          className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="text">Short answer</option>
                          <option value="multiple_choice">Multiple choice</option>
                          <option value="rating">Rating scale</option>
                        </select>
                      </div>
                    </div>

                    {q.type === "multiple_choice" && (
                      <div className="mt-4 space-y-2">
                        <Label>Options</Label>
                        <ul className="space-y-2">
                          {mcOpts.map((opt, idx) => (
                            <li key={idx} className="flex items-center gap-2">
                              <Input
                                value={opt}
                                onChange={(e) => {
                                  const next = [...mcOpts];
                                  next[idx] = e.target.value;
                                  updateQuestion(q.key, { options: next });
                                }}
                                placeholder={`Option ${idx + 1}`}
                                maxLength={120}
                                autoComplete="off"
                                data-1p-ignore
                                data-lpignore="true"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (mcOpts.length <= 2) return;
                                  updateQuestion(q.key, {
                                    options: mcOpts.filter((_, j) => j !== idx),
                                  });
                                }}
                                disabled={mcOpts.length <= 2}
                                aria-label="Remove option"
                                className="rounded-lg p-2 text-ink/50 hover:bg-ink/5 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <X className="size-4" />
                              </button>
                            </li>
                          ))}
                        </ul>
                        <button
                          type="button"
                          onClick={() =>
                            updateQuestion(q.key, {
                              options: [...mcOpts, `Option ${mcOpts.length + 1}`],
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:bg-ink/5"
                        >
                          <Plus className="size-3.5" />
                          Add option
                        </button>
                      </div>
                    )}

                    {q.type === "rating" && (
                      <div className="mt-4 space-y-2">
                        <Label htmlFor={`q-${q.key}-max`}>Max stars</Label>
                        <select
                          id={`q-${q.key}-max`}
                          value={ratingMax}
                          onChange={(e) =>
                            updateQuestion(q.key, { options: { max: Number(e.target.value) } })
                          }
                          className="flex h-9 w-32 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          {RATING_MAX_CHOICES.map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <button
              type="button"
              onClick={addQuestion}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-full border border-dashed border-ink/20 bg-white px-5 py-2.5 text-sm font-semibold text-ink/70 transition-colors hover:border-brand hover:bg-brand/5 hover:text-brand"
            >
              <Plus className="size-4" />
              Add question
            </button>
          </section>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center rounded-full border border-ink/10 bg-white px-5 py-2.5 text-sm font-semibold text-ink/70 transition-colors hover:bg-ink/5"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground transition-all hover:shadow-lg hover:shadow-brand/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createForm.isPending ? "Creating…" : "Create form"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
