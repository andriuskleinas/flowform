import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { QuestionRender, type Question } from "@/components/question-render";

export const Route = createFileRoute("/forms/$formId")({
  component: PublicFormPage,
});

type FormRow = { id: string; title: string; description: string | null; user_id: string };

function PublicFormPage() {
  const { formId } = Route.useParams();
  const { user } = useAuth();
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);

  const formQ = useQuery({
    queryKey: ["public-form", formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forms")
        .select("id, title, description, user_id")
        .eq("id", formId)
        .maybeSingle();
      if (error) throw error;
      return data as FormRow | null;
    },
  });

  const questionsQ = useQuery({
    queryKey: ["public-questions", formId],
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

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("responses")
        .insert({ form_id: formId, answers });
      if (error) throw error;
    },
    onSuccess: () => setSubmitted(true),
    onError: (e: Error) => toast.error(e.message || "Could not submit"),
  });

  const questions = questionsQ.data ?? [];
  const allAnswered = questions.every((q) => {
    const v = answers[q.id];
    if (q.type === "text") return typeof v === "string" && v.trim().length > 0;
    if (q.type === "multiple_choice") return typeof v === "string" && v.length > 0;
    if (q.type === "rating") return typeof v === "number" && v > 0;
    return false;
  });

  if (formQ.isLoading) {
    return (
      <Shell>
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="mt-3 h-5 w-1/2" />
      </Shell>
    );
  }

  if (!formQ.data) {
    return (
      <Shell>
        <h1 className="text-3xl font-extrabold tracking-tight">Form not found</h1>
        <p className="mt-3 text-ink/60">This form may have been deleted or the link is incorrect.</p>
        <Link to="/" className="mt-6 inline-block text-brand underline">
          Go home
        </Link>
      </Shell>
    );
  }

  if (submitted) {
    return (
      <Shell>
        <div className="flex flex-col items-center text-center">
          <CheckCircle2 className="size-14 text-brand" />
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Thanks!</h1>
          <p className="mt-2 text-ink/60">Your response was recorded.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{formQ.data.title}</h1>
        {formQ.data.description && (
          <p className="mt-3 text-base text-ink/60 md:text-lg">{formQ.data.description}</p>
        )}
      </header>

      <form
        className="mt-10 space-y-8"
        onSubmit={(e) => {
          e.preventDefault();
          if (allAnswered && !submit.isPending) submit.mutate();
        }}
      >
        {questions.length === 0 && (
          <p className="rounded-2xl border border-dashed border-ink/15 bg-white/50 p-8 text-center text-ink/60">
            This form has no questions yet.
          </p>
        )}

        {questions.map((q, i) => (
          <div key={q.id} className="rounded-2xl border border-ink/5 bg-white p-6 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink/40">
              Question {i + 1}
            </p>
            <QuestionRender
              question={q}
              value={answers[q.id]}
              onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
            />
          </div>
        ))}

        {questions.length > 0 && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!allAnswered || submit.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground transition-all hover:shadow-lg hover:shadow-brand/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submit.isPending ? "Submitting…" : "Submit"}
            </button>
          </div>
        )}
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <main className="mx-auto max-w-2xl px-6 py-12 md:px-8 md:py-16">{children}</main>
    </div>
  );
}
