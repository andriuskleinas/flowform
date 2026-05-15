import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { StarRating, type Question } from "@/components/question-render";

export const Route = createFileRoute("/forms/$formId/responses")({
  component: ResponsesPage,
});

type ResponseRow = {
  id: string;
  submitted_at: string;
  answers: Record<string, any>;
};

function ResponsesPage() {
  const { formId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login", search: { redirect: `/forms/${formId}/responses` } });
    }
  }, [loading, user, navigate, formId]);

  const formQ = useQuery({
    enabled: !!user,
    queryKey: ["form", formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forms")
        .select("id, title, user_id")
        .eq("id", formId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const questionsQ = useQuery({
    enabled: !!user,
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

  const responsesQ = useQuery({
    enabled: !!user,
    queryKey: ["responses", formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("responses")
        .select("id, submitted_at, answers")
        .eq("form_id", formId)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ResponseRow[];
    },
  });

  if (loading || formQ.isLoading) {
    return (
      <Shell>
        <Skeleton className="h-10 w-64" />
      </Shell>
    );
  }

  if (!formQ.data || (user && formQ.data.user_id !== user.id)) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold">Form not found</h1>
        <Link to="/dashboard" className="mt-6 inline-block text-brand underline">
          Back to dashboard
        </Link>
      </Shell>
    );
  }

  const questions = questionsQ.data ?? [];
  const responses = responsesQ.data ?? [];

  return (
    <Shell>
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/60 hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Back to dashboard
      </Link>

      <header className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{formQ.data.title}</h1>
          <p className="mt-1 text-ink/60">
            {responses.length} {responses.length === 1 ? "response" : "responses"}
          </p>
        </div>
      </header>

      {responses.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-ink/15 bg-white/50 p-10 text-center">
          <p className="text-ink/60">No responses yet. Share your form to start collecting answers.</p>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {responses.map((r) => (
            <li key={r.id} className="rounded-2xl border border-ink/5 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">
                {new Date(r.submitted_at).toLocaleString()}
              </p>
              <dl className="mt-4 space-y-4">
                {questions.map((q) => (
                  <div key={q.id}>
                    <dt className="text-sm font-semibold text-ink">{q.label}</dt>
                    <dd className="mt-1 text-sm text-ink/70">
                      <AnswerView question={q} value={r.answers?.[q.id]} />
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

function AnswerView({ question, value }: { question: Question; value: any }) {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  ) {
    return <span className="italic text-ink/40">No answer</span>;
  }
  if (question.type === "rating") {
    return <StarRating max={question.options?.max ?? 5} value={Number(value)} disabled size={18} />;
  }
  if (Array.isArray(value)) {
    return <span>{value.join(", ")}</span>;
  }
  return <span>{String(value)}</span>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <main className="mx-auto max-w-3xl px-6 py-10 md:px-8 md:py-14">{children}</main>
    </div>
  );
}
