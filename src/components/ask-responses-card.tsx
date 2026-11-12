import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Filter, Loader2, MessageSquareText, X } from "lucide-react";
import { toast } from "sonner";

import { askResponses, type AskResult } from "@/lib/ask-responses";

const OP_LABELS: Record<string, string> = {
  equals: "is",
  not_equals: "is not",
  contains: "contains",
  gte: "≥",
  lte: "≤",
  answered: "is answered",
  not_answered: "is not answered",
  after: "after",
  before: "before",
};

/**
 * Natural-language questions over the responses. Claude turns the question
 * into a filter (shown as chips so the owner can check it), the server runs
 * it, and Claude answers from the matching responses.
 */
export function AskResponsesCard({
  formId,
  version,
  examples,
  onShowMatches,
}: {
  formId: string;
  version: number | null;
  examples: string[];
  onShowMatches: (result: AskResult) => void;
}) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<(AskResult & { question: string }) | null>(null);

  const ask = useMutation({
    mutationFn: async (q: string) => ({
      question: q,
      ...(await askResponses({
        data: { formId, question: q, ...(version != null ? { version } : {}) },
      })),
    }),
    onSuccess: setResult,
    onError: (e: Error) =>
      toast.error(e.message || "Claude couldn’t answer that. Try rephrasing it."),
  });

  const submit = (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 3 || ask.isPending) return;
    setQuestion(trimmed);
    ask.mutate(trimmed);
  };

  return (
    <section className="rounded-lg border border-hairline bg-card p-5">
      <div className="flex items-center gap-2">
        <MessageSquareText className="size-4 text-brand" aria-hidden />
        <h3 className="text-sm font-semibold text-ink">Ask your responses</h3>
        <span className="text-xs text-ink/45">— in plain English, answered by Claude</span>
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(question);
        }}
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={300}
          placeholder="e.g. What do people who rated us low complain about?"
          aria-label="Question about your responses"
          className="h-10 min-w-0 flex-1 rounded-md border border-input bg-surface px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <button
          type="submit"
          disabled={ask.isPending || question.trim().length < 3}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
        >
          {ask.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowRight className="size-4" />
          )}
          Ask
        </button>
      </form>

      {!result && !ask.isPending && examples.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {examples.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => submit(ex)}
              className="rounded-full border border-hairline px-2.5 py-1 text-xs text-ink/65 hover:border-brand/40 hover:text-ink"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {ask.isPending && (
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-ink/55">
          <Loader2 className="size-4 animate-spin" /> Turning your question into a filter, then
          reading the matching responses…
        </p>
      )}

      {result && !ask.isPending && (
        <div className="mt-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-medium text-ink/50">“{result.question}”</p>
            <button
              type="button"
              aria-label="Clear answer"
              onClick={() => setResult(null)}
              className="rounded p-1 text-ink/40 hover:bg-ink/5 hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-surface px-3 py-2 text-xs">
            <Filter className="size-3.5 text-ink/45" aria-hidden />
            {result.filter.conditions.length === 0 ? (
              <span className="text-ink/60">All responses</span>
            ) : (
              result.filter.conditions.map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1">
                  {i > 0 && (
                    <span className="font-mono text-[10px] uppercase text-ink/40">
                      {result.filter.match === "any" ? "or" : "and"}
                    </span>
                  )}
                  <span className="rounded border border-hairline bg-card px-1.5 py-0.5">
                    <span className="text-ink/60">{c.label.slice(0, 40)}</span>{" "}
                    <span className="text-ink/40">{OP_LABELS[c.op] ?? c.op}</span>{" "}
                    {c.value && <span className="font-medium text-ink">{c.value}</span>}
                  </span>
                </span>
              ))
            )}
            <span className="ml-auto font-mono text-ink/55">
              {result.matchedCount} of {result.total}
            </span>
          </div>

          <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink">
            {result.answer}
          </p>

          {result.highlights.length > 0 && (
            <ul className="space-y-1.5">
              {result.highlights.map((h, i) => (
                <li key={i} className="border-l-2 border-brand/40 pl-3 text-sm italic text-ink/65">
                  “{h}”
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p className="text-[11px] text-ink/40">
              {result.capped
                ? `Searched the newest ${result.total} responses.`
                : "Claude chose the filter. The matching is exact."}
            </p>
            {result.matchedCount > 0 && result.filter.conditions.length > 0 && (
              <button
                type="button"
                onClick={() => onShowMatches(result)}
                className="text-sm font-medium text-brand hover:underline"
              >
                Show{" "}
                {result.matchedCount === 1
                  ? "this response"
                  : `these ${Math.min(result.matchedCount, result.matchedIds.length)} responses`}{" "}
                →
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
