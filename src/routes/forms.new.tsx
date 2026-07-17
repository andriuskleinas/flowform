import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { QuestionType, QuestionOptions } from "@/lib/form-utils";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/forms/new")({
  head: () => ({
    meta: [
      { title: "Create a new form — Flowform" },
      { name: "description", content: "Start a new Flowform from scratch or a template." },
    ],
  }),
  component: NewFormPage,
});

type TemplateQuestion = {
  type: QuestionType;
  label: string;
  options: QuestionOptions;
  required: boolean;
};

type Template = {
  id: string;
  emoji: string;
  name: string;
  blurb: string;
  title: string;
  description: string;
  questions: TemplateQuestion[];
};

const TEMPLATES: Template[] = [
  {
    id: "customer-nps",
    emoji: "💜",
    name: "Customer feedback",
    blurb: "NPS + satisfaction + open feedback",
    title: "Customer feedback survey",
    description: "Help us understand how we're doing and what to improve.",
    questions: [
      {
        type: "nps",
        label: "How likely are you to recommend us to a friend or colleague?",
        options: null,
        required: true,
      },
      {
        type: "rating",
        label: "How satisfied are you with the product overall?",
        options: { max: 5 },
        required: true,
      },
      {
        type: "multiple_choice",
        label: "How often do you use the product?",
        options: { choices: ["Daily", "Weekly", "Monthly", "Rarely"], multi: false },
        required: true,
      },
      { type: "long_text", label: "What could we do better?", options: null, required: false },
    ],
  },
  {
    id: "event-feedback",
    emoji: "🎪",
    name: "Event feedback",
    blurb: "Rating, highlights, suggestions",
    title: "Event feedback",
    description: "Thanks for joining us — tell us how it went!",
    questions: [
      {
        type: "rating",
        label: "How would you rate the event overall?",
        options: { max: 5 },
        required: true,
      },
      { type: "yes_no", label: "Would you attend again?", options: null, required: true },
      {
        type: "multiple_choice",
        label: "Which parts did you enjoy most?",
        options: { choices: ["Talks", "Workshops", "Networking", "Venue & catering"], multi: true },
        required: false,
      },
      {
        type: "long_text",
        label: "Any suggestions for next time?",
        options: null,
        required: false,
      },
    ],
  },
  {
    id: "employee-pulse",
    emoji: "🌡️",
    name: "Employee pulse",
    blurb: "Quick weekly team check-in",
    title: "Team pulse check",
    description: "A quick, anonymous check-in — it takes less than a minute.",
    questions: [
      {
        type: "rating",
        label: "How are you feeling at work this week?",
        options: { max: 5 },
        required: true,
      },
      {
        type: "nps",
        label: "How likely are you to recommend working here?",
        options: null,
        required: true,
      },
      {
        type: "yes_no",
        label: "Do you have what you need to do your best work?",
        options: null,
        required: true,
      },
      {
        type: "long_text",
        label: "Anything you'd like to share with the team?",
        options: null,
        required: false,
      },
    ],
  },
];

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
  // Which card was clicked, so only that one shows a spinner.
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Create the form (+ any template questions), then hand off to the editor —
  // the single canonical builder for title, questions, logic, and AI.
  const createForm = useMutation({
    mutationFn: async (template: Template | null) => {
      const { data: form, error: fErr } = await supabase
        .from("forms")
        .insert({
          title: template?.title ?? "Untitled form",
          description: template?.description ?? null,
          user_id: userId,
        })
        .select("id")
        .single();
      if (fErr) throw fErr;
      const newId = form.id as string;

      const templateQuestions = template?.questions ?? [];
      if (templateQuestions.length > 0) {
        const rows = templateQuestions.map((q, i) => ({
          form_id: newId,
          type: q.type,
          label: q.label,
          options: q.options,
          position: i,
          required: q.required,
        }));
        const { error: qErr } = await supabase.from("questions").insert(rows);
        if (qErr) throw qErr;
      }
      return newId;
    },
    onSuccess: (newId) => {
      qc.invalidateQueries({ queryKey: ["forms", userId] });
      qc.invalidateQueries({ queryKey: ["dashboard-forms", userId] });
      navigate({ to: "/forms/$formId/edit", params: { formId: newId } });
    },
    onError: (err: Error) => {
      setPendingId(null);
      toast.error(err.message || "Could not create form");
    },
  });

  const start = (id: string, template: Template | null) => {
    if (createForm.isPending) return;
    setPendingId(id);
    createForm.mutate(template);
  };

  const busy = createForm.isPending;

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

      <main className="mx-auto max-w-4xl px-6 pb-24 pt-10 md:px-8 md:pt-14">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">Create a new form</h1>
          <p className="mt-3 text-base text-ink/60 md:text-lg">
            Start blank or from a template. You'll add questions, logic, and AI suggestions in the
            editor.
          </p>
        </div>

        {/* Blank */}
        <button
          type="button"
          onClick={() => start("blank", null)}
          disabled={busy}
          className="group mt-8 flex w-full items-center justify-between gap-4 rounded-2xl border border-ink/10 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          <div className="flex items-center gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
              {pendingId === "blank" ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Plus className="size-5" />
              )}
            </span>
            <div>
              <p className="text-base font-bold text-ink">Blank form</p>
              <p className="mt-0.5 text-sm text-ink/50">Start from scratch with an empty form.</p>
            </div>
          </div>
          <ArrowRight className="size-5 shrink-0 text-ink/30 transition-colors group-hover:text-brand" />
        </button>

        {/* Templates */}
        <h2 className="mt-10 text-sm font-semibold uppercase tracking-[0.15em] text-ink/40">
          Or start from a template
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => start(t.id, t)}
              disabled={busy}
              className="relative flex flex-col rounded-2xl border border-ink/10 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              <span className="text-2xl">{t.emoji}</span>
              <p className="mt-3 text-sm font-bold text-ink">{t.name}</p>
              <p className="mt-0.5 text-xs text-ink/50">{t.blurb}</p>
              <p className="mt-3 text-xs font-medium text-ink/40">{t.questions.length} questions</p>
              {pendingId === t.id && (
                <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/70">
                  <Loader2 className="size-5 animate-spin text-brand" />
                </span>
              )}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
