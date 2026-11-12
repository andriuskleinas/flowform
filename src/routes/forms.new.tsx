import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DEFAULT_FORM_TITLE, type QuestionType, type QuestionOptions } from "@/lib/form-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryField } from "@/components/dashboard/category-dialog";
import { Logo } from "@/components/logo";
import { permissions, useWorkspaceRole, useWorkspaces, workspaceName } from "@/lib/workspace";

export const Route = createFileRoute("/forms/new")({
  head: () => ({
    meta: [
      { title: "Create a new form — Flowform" },
      { name: "description", content: "Start a new Flowform from scratch or a template." },
    ],
  }),
  // ?ws=<owner id>: create the form in a team workspace you can edit.
  validateSearch: (s: Record<string, unknown>): { ws?: string } => ({
    ws: typeof s.ws === "string" && /^[0-9a-f-]{36}$/i.test(s.ws) ? s.ws.toLowerCase() : undefined,
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
    title: "Customer feedback",
    description: "Help us understand how we’re doing and what to improve.",
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
    description: "Thanks for coming. Tell us how it went.",
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
    description: "A quick, anonymous check-in. Under a minute.",
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
        label: "Anything you’d like to share with the team?",
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
  const { ws } = Route.useSearch();
  const ownerId = ws ?? userId;
  const isOwn = ownerId === userId;
  const { role, isLoading: roleLoading } = useWorkspaceRole(userId, ownerId);
  const { data: workspaces = [] } = useWorkspaces(userId);
  const workspace = workspaces.find((w) => w.owner_id === ownerId);
  // Which card was clicked, so only that one shows a spinner.
  const [pendingId, setPendingId] = useState<string | null>(null);
  // Optional topic chosen up front; applied to whichever start option is clicked.
  const [categoryId, setCategoryId] = useState<string | null>(null);

  // Create the form (+ any template questions), then hand off to the editor —
  // the single canonical builder for title, questions, logic, and AI.
  const createForm = useMutation({
    mutationFn: async (template: Template | null) => {
      const { data: form, error: fErr } = await supabase
        .from("forms")
        .insert({
          title: template?.title ?? DEFAULT_FORM_TITLE,
          description: template?.description ?? null,
          category_id: categoryId,
          user_id: ownerId,
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
      qc.invalidateQueries({ queryKey: ["dashboard-forms", ownerId] });
      navigate({ to: "/forms/$formId/edit", params: { formId: newId } });
    },
    onError: (err: Error) => {
      setPendingId(null);
      toast.error(err.message || "Couldn’t create the form. Try again.");
    },
  });

  const start = (id: string, template: Template | null) => {
    if (createForm.isPending) return;
    setPendingId(id);
    createForm.mutate(template);
  };

  const busy = createForm.isPending;

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-surface p-10">
        <Skeleton className="h-10 w-64" />
      </div>
    );
  }
  if (!permissions(role).canEdit) {
    return (
      <div className="min-h-screen bg-surface text-ink">
        <main className="mx-auto max-w-xl px-6 py-24 text-center">
          <h1 className="font-display text-3xl">You can’t create forms here</h1>
          <p className="mt-3 text-ink/60">
            {role === "viewer"
              ? "You’re a viewer in this workspace. Ask an admin for editor access."
              : "You don’t have access to this workspace."}
          </p>
          <Link to="/dashboard" className="mt-6 inline-block text-brand underline">
            Back to dashboard
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-ink">
      <header className="border-b border-hairline">
        <nav className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6 md:px-8">
          <Link to="/" className="flex items-center gap-2">
            <Logo />
          </Link>
          <Link
            to="/dashboard"
            search={isOwn ? {} : { ws: ownerId }}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/60 transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-4" />
            Dashboard
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-24 pt-10 md:px-8 md:pt-14">
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl md:text-5xl">Create a new form</h1>
          <p className="mt-3 text-base text-ink/60 md:text-lg">
            Start blank or from a template. Questions, logic and Claude’s drafts come next, in the
            editor.
          </p>
          {!isOwn && workspace && (
            <p className="mt-3 inline-flex rounded-full border border-hairline bg-card px-3 py-1 text-xs text-ink/70">
              Creating in {workspaceName(workspace)}
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-sm text-ink/60">Category</span>
            <CategoryField
              userId={ownerId}
              value={categoryId}
              onChange={setCategoryId}
              pending={busy}
            />
            <span className="text-xs text-ink/40">optional</span>
          </div>
        </div>

        {/* Blank */}
        <button
          type="button"
          onClick={() => start("blank", null)}
          disabled={busy}
          className="group mt-8 flex w-full items-center justify-between gap-4 rounded-2xl border border-hairline bg-card p-5 text-left transition-all hover:border-ink/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <div className="flex items-center gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface text-ink/60">
              {pendingId === "blank" ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Plus className="size-5" />
              )}
            </span>
            <div>
              <p className="text-base font-semibold text-ink">Blank form</p>
              <p className="mt-0.5 text-sm text-ink/50">An empty page. Brave.</p>
            </div>
          </div>
          <ArrowRight className="size-5 shrink-0 text-ink/30 transition-colors group-hover:text-brand" />
        </button>

        {/* Templates */}
        <h2 className="mt-10 text-[15px] font-medium tracking-normal text-ink">
          Or start from a template
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => start(t.id, t)}
              disabled={busy}
              className="relative flex flex-col rounded-2xl border border-hairline bg-card p-5 text-left transition-all hover:border-ink/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="font-mono text-[11px] text-brand">
                {String(TEMPLATES.indexOf(t) + 1).padStart(2, "0")}
              </span>
              <p className="mt-3 text-sm font-semibold text-ink">{t.name}</p>
              <p className="mt-0.5 text-xs text-ink/50">{t.blurb}</p>
              <p className="mt-3 text-xs font-medium text-ink/40">{t.questions.length} questions</p>
              {pendingId === t.id && (
                <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-card/70">
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
