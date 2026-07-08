import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, CircleSlash, Pencil } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  isAnswered,
  validateAnswerLength,
  MAX_ANSWER_LENGTH,
  type Answers,
  type FormStatus,
} from "@/lib/form-utils";
import { getPublicFormMeta } from "@/lib/form-meta";
import { Skeleton } from "@/components/ui/skeleton";
import { QuestionRender, type Question } from "@/components/question-render";
import { Shell } from "@/components/shell";

export const Route = createFileRoute("/forms/$formId/")({
  // Loader exists solely to feed head(): per-form OG/meta tags rendered
  // during SSR so shared links preview with the form's own title.
  loader: async ({ params }) => {
    try {
      return await getPublicFormMeta({ data: { formId: params.formId } });
    } catch {
      return null;
    }
  },
  head: ({ loaderData }) => {
    const title = loaderData?.title ? `${loaderData.title} — Flowform` : "Flowform";
    const description =
      loaderData?.description?.trim() ||
      (loaderData?.title
        ? `Share your answers to "${loaderData.title}" — it only takes a minute.`
        : "A form built with Flowform.");
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
      ],
    };
  },
  component: PublicFormPage,
});

type FormRow = {
  id: string;
  title: string;
  description: string | null;
  user_id: string;
  status: FormStatus;
};

function PublicFormPage() {
  const { formId } = Route.useParams();
  const { user } = useAuth();
  const [answers, setAnswers] = useState<Answers>({});
  const [submitted, setSubmitted] = useState(false);
  // Only surface missing-required errors after a submit attempt.
  const [showErrors, setShowErrors] = useState(false);
  // This device already submitted this form (localStorage flag).
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  // Set on first interaction, not page load, so fill-time reflects actual engagement.
  const startedAtRef = useRef<string | null>(null);
  const recordStart = () => {
    if (!startedAtRef.current) startedAtRef.current = new Date().toISOString();
  };

  const draftKey = `flowform:draft:${formId}`;
  const submittedKey = `flowform:submitted:${formId}`;
  // Don't persist until the stored draft (if any) has been restored,
  // otherwise the initial empty state would overwrite it.
  const restoredRef = useRef(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(submittedKey)) setAlreadySubmitted(true);
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { answers?: Answers; startedAt?: string };
        if (parsed?.answers && typeof parsed.answers === "object") {
          setAnswers(parsed.answers);
          if (typeof parsed.startedAt === "string") startedAtRef.current = parsed.startedAt;
        }
      }
    } catch {
      // Storage unavailable (private mode) or corrupt draft — start fresh.
    }
    restoredRef.current = true;
  }, [draftKey, submittedKey]);

  useEffect(() => {
    if (!restoredRef.current || submitted || Object.keys(answers).length === 0) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ answers, startedAt: startedAtRef.current }));
    } catch {
      // Best-effort only.
    }
  }, [answers, draftKey, submitted]);

  const formQ = useQuery({
    queryKey: ["public-form", formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forms")
        .select("id, title, description, user_id, status")
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
        .select("id, form_id, type, label, options, position, required")
        .eq("form_id", formId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Question[];
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      for (const [, v] of Object.entries(answers)) {
        if (!validateAnswerLength(v))
          throw new Error(`An answer exceeds the ${MAX_ANSWER_LENGTH}-character limit.`);
      }
      const { error } = await supabase
        .from("responses")
        .insert({ form_id: formId, answers, started_at: startedAtRef.current });
      if (error) throw error;
    },
    onSuccess: () => {
      setSubmitted(true);
      try {
        localStorage.setItem(submittedKey, new Date().toISOString());
        localStorage.removeItem(draftKey);
      } catch {
        // Best-effort only.
      }
    },
    onError: (e: Error) => {
      // An RLS violation here means the form stopped accepting responses
      // (closed/unpublished) after the respondent loaded the page. Surface
      // that instead of the raw Postgres policy error.
      const msg = /row-level security/i.test(e.message)
        ? "This form is no longer accepting responses."
        : e.message || "Could not submit";
      toast.error(msg);
    },
  });

  const questions = questionsQ.data ?? [];
  const missingRequired = questions.filter((q) => q.required && !isAnswered(q, answers[q.id]));

  if (formQ.isLoading) {
    return (
      <Shell width="sm">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="mt-3 h-5 w-1/2" />
      </Shell>
    );
  }

  if (!formQ.data) {
    return (
      <Shell width="sm">
        <h1 className="text-3xl font-extrabold tracking-tight">Form not found</h1>
        <p className="mt-3 text-ink/60">
          This form may have been deleted or the link is incorrect.
        </p>
        <Link to="/" className="mt-6 inline-block text-brand underline">
          Go home
        </Link>
      </Shell>
    );
  }

  const status = formQ.data.status;
  const isOwner = !!user && !!formQ.data && user.id === formQ.data.user_id;
  const ownerNav = isOwner ? (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-brand/20 bg-brand/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/15 text-brand">
          <Pencil className="size-4" />
        </span>
        <div className="text-sm">
          <p className="font-semibold text-ink">You're viewing the public version of this form.</p>
          <p className="text-ink/60">
            {status === "draft" &&
              "Draft — respondents can't see this yet. Publish from the editor to share it."}
            {status === "published" &&
              "This is what respondents see. To change questions, open the editor."}
            {status === "closed" &&
              "Closed — respondents see this notice. Reopen from the editor to accept more responses."}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-ink/70 hover:bg-ink/5 hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Dashboard
        </Link>
        <Link
          to="/forms/$formId/edit"
          params={{ formId }}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:shadow-lg hover:shadow-brand/25"
        >
          <Pencil className="size-4" /> Edit form
        </Link>
      </div>
    </div>
  ) : null;

  if (status === "closed") {
    return (
      <Shell width="sm">
        {ownerNav}
        <div className="flex flex-col items-center text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <CircleSlash className="size-7" />
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">This survey is closed</h1>
          <p className="mt-3 max-w-sm text-ink/60">
            <span className="font-semibold text-ink">{formQ.data.title}</span> is no longer
            accepting responses. Thanks to everyone who took part.
          </p>
        </div>
      </Shell>
    );
  }

  if (status === "draft" && !isOwner) {
    return (
      <Shell width="sm">
        <h1 className="text-3xl font-extrabold tracking-tight">This form isn't published yet</h1>
        <p className="mt-3 text-ink/60">The owner hasn't published this form. Check back later.</p>
        <Link to="/" className="mt-6 inline-block text-brand underline">
          Go home
        </Link>
      </Shell>
    );
  }

  if (submitted) {
    return (
      <Shell width="sm">
        {ownerNav}
        <div className="flex flex-col items-center text-center">
          <CheckCircle2 className="size-14 text-brand" />
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Thanks!</h1>
          <p className="mt-2 text-ink/60">Your response was recorded.</p>
        </div>
      </Shell>
    );
  }

  if (alreadySubmitted) {
    return (
      <Shell width="sm">
        {ownerNav}
        <div className="flex flex-col items-center text-center">
          <CheckCircle2 className="size-14 text-brand" />
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">You've already responded</h1>
          <p className="mt-2 max-w-sm text-ink/60">
            Looks like this form was already submitted from this device.
          </p>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.removeItem(submittedKey);
              } catch {
                // Best-effort only.
              }
              setAlreadySubmitted(false);
              setAnswers({});
              setShowErrors(false);
              startedAtRef.current = null;
            }}
            className="mt-6 inline-flex items-center justify-center rounded-full border border-ink/15 bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-ink/5"
          >
            Submit another response
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell width="sm">
      {ownerNav}
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{formQ.data.title}</h1>
        {formQ.data.description && (
          <p className="mt-3 text-base text-ink/60 md:text-lg">{formQ.data.description}</p>
        )}
      </header>

      <form
        className="mt-10 space-y-8"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (submit.isPending) return;
          if (missingRequired.length > 0) {
            setShowErrors(true);
            document
              .getElementById(`qcard-${missingRequired[0].id}`)
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
          }
          if (!Object.values(answers).every(validateAnswerLength)) {
            toast.error(`An answer exceeds the ${MAX_ANSWER_LENGTH}-character limit.`);
            return;
          }
          submit.mutate();
        }}
      >
        {questions.length === 0 && (
          <p className="rounded-2xl border border-dashed border-ink/15 bg-white/50 p-8 text-center text-ink/60">
            This form has no questions yet.
          </p>
        )}

        {questions.map((q, i) => {
          const missing = showErrors && q.required && !isAnswered(q, answers[q.id]);
          return (
            <div
              key={q.id}
              id={`qcard-${q.id}`}
              className={
                "rounded-2xl border bg-white p-6 shadow-sm transition-colors " +
                (missing ? "border-red-300 ring-1 ring-red-200" : "border-ink/5")
              }
            >
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink/40">
                Question {i + 1}
                {!q.required && <span className="ml-2 font-medium text-ink/35">· Optional</span>}
              </p>
              <QuestionRender
                question={q}
                value={answers[q.id]}
                onChange={(v) => {
                  recordStart();
                  setAnswers((a) => ({ ...a, [q.id]: v }));
                }}
              />
              {missing && (
                <p className="mt-3 text-sm font-medium text-red-600">
                  This question needs an answer.
                </p>
              )}
            </div>
          );
        })}

        {questions.length > 0 && (
          <div className="flex items-center justify-end gap-4">
            {showErrors && missingRequired.length > 0 && (
              <p className="text-sm font-medium text-red-600">
                {missingRequired.length} required{" "}
                {missingRequired.length === 1 ? "question needs" : "questions need"} an answer.
              </p>
            )}
            <button
              type="submit"
              disabled={submit.isPending}
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
