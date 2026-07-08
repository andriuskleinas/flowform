import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

import { QuestionRender, type Question } from "@/components/question-render";
import {
  isAnswered,
  resolveNextIndex,
  computeVisiblePath,
  type Answers,
  type AnswerValue,
} from "@/lib/form-utils";

/** Question types that advance automatically right after a choice is made. */
const AUTO_ADVANCE: ReadonlySet<string> = new Set([
  "yes_no",
  "dropdown",
  "nps",
  "rating",
  "multiple_choice", // single-select only; multi is checked at runtime
]);

function autoAdvances(q: Question): boolean {
  if (!AUTO_ADVANCE.has(q.type)) return false;
  if (q.type === "multiple_choice") {
    const opts = q.options;
    const multi = Array.isArray(opts) ? true : opts && "multi" in opts ? opts.multi : false;
    return !multi;
  }
  return true;
}

/**
 * One-question-at-a-time respondent experience: progress bar, Enter to
 * advance, back navigation, auto-advance on single choices, and logic-jump
 * routing. Owns only navigation state — answers live in the parent so
 * persistence and submission stay in one place.
 */
export function ConversationalForm({
  questions,
  answers,
  onAnswer,
  onSubmit,
  onShowQuestion,
  submitting = false,
  preview = false,
}: {
  questions: Question[];
  answers: Answers;
  onAnswer: (questionId: string, value: AnswerValue) => void;
  onSubmit: () => void;
  /** Fired whenever a question becomes the visible step (funnel analytics). */
  onShowQuestion?: (questionId: string) => void;
  submitting?: boolean;
  /** Preview mode disables the final submit. */
  preview?: boolean;
}) {
  // index === questions.length → the submit card.
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [error, setError] = useState(false);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Restored drafts skip ahead to the first unanswered question on the path.
  const fastForwarded = useRef(false);
  useEffect(() => {
    if (fastForwarded.current || questions.length === 0) return;
    fastForwarded.current = true;
    if (Object.keys(answers).length === 0) return;
    const path = computeVisiblePath(questions, answers);
    const visited: number[] = [];
    for (const i of path) {
      if (!isAnswered(questions[i], answers[questions[i].id])) break;
      visited.push(i);
    }
    if (visited.length === 0) return;
    // Stop on the question after the last answered one (or the submit card).
    const last = visited[visited.length - 1];
    setHistory(visited);
    setIndex(resolveNextIndex(questions, last, answers[questions[last].id]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions]);

  useEffect(
    () => () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
    },
    [],
  );

  const total = questions.length;
  const atSubmit = index >= total;
  const current = atSubmit ? null : questions[index];

  const currentId = current?.id;
  useEffect(() => {
    if (currentId) onShowQuestion?.(currentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  const answeredCount = questions.filter((q) => isAnswered(q, answers[q.id])).length;
  const progress = atSubmit ? 100 : Math.round((answeredCount / Math.max(total, 1)) * 100);

  const advanceFrom = (idx: number, value: AnswerValue | undefined) => {
    const q = questions[idx];
    if (q.required && !isAnswered(q, value)) {
      setError(true);
      return;
    }
    setError(false);
    setHistory((h) => [...h, idx]);
    setIndex(resolveNextIndex(questions, idx, value));
  };

  const advance = () => {
    if (current) advanceFrom(index, answers[current.id]);
  };

  const back = () => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    setError(false);
    setHistory((h) => {
      if (h.length === 0) return h;
      setIndex(h[h.length - 1]);
      return h.slice(0, -1);
    });
  };

  const handleAnswer = (value: AnswerValue) => {
    if (!current) return;
    setError(false);
    onAnswer(current.id, value);
    if (autoAdvances(current)) {
      if (autoTimer.current) clearTimeout(autoTimer.current);
      const idx = index;
      autoTimer.current = setTimeout(() => advanceFrom(idx, value), 350);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    const target = e.target as HTMLElement;
    if (target.tagName === "TEXTAREA") {
      // Enter makes a newline in long answers; Ctrl/⌘+Enter advances.
      if (!(e.ctrlKey || e.metaKey)) return;
    }
    e.preventDefault();
    if (atSubmit) {
      if (!preview && !submitting) onSubmit();
    } else {
      advance();
    }
  };

  if (total === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-ink/15 bg-white/50 p-8 text-center text-ink/60">
        This form has no questions yet.
      </p>
    );
  }

  return (
    <div ref={containerRef} onKeyDown={onKeyDown}>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-brand transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {!atSubmit && current && (
        <div
          key={current.id}
          className="mt-10 motion-safe:animate-[demo-step-in_0.4s_ease-out_both]"
        >
          {history.length > 0 && (
            <button
              type="button"
              onClick={back}
              className="mb-6 flex w-fit items-center gap-1.5 text-xs font-medium text-ink/40 transition-colors hover:text-ink"
            >
              <ArrowLeft className="size-3.5" /> Back
            </button>
          )}

          <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">
            Question {history.length + 1}
            {!current.required && <span className="ml-2 font-medium text-ink/35">· Optional</span>}
          </p>

          <div className="mt-4">
            <QuestionRender
              question={current}
              value={answers[current.id]}
              onChange={handleAnswer}
            />
          </div>

          {error && (
            <p className="mt-4 text-sm font-medium text-red-600">This question needs an answer.</p>
          )}

          <div className="mt-8 flex items-center gap-4">
            <button
              type="button"
              onClick={advance}
              className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground shadow-md shadow-brand/20 transition-all hover:scale-[1.02]"
            >
              {current.required || isAnswered(current, answers[current.id]) ? "OK" : "Skip"}
            </button>
            <span className="hidden text-xs text-ink/40 sm:inline">
              {current.type === "long_text" ? "⌘/Ctrl + Enter ↵" : "press Enter ↵"}
            </span>
          </div>
        </div>
      )}

      {atSubmit && (
        <div className="mt-10 text-center motion-safe:animate-[demo-step-in_0.4s_ease-out_both]">
          <CheckCircle2 className="mx-auto size-12 text-brand" />
          <h2 className="mt-4 text-2xl font-extrabold tracking-tight">You're all set</h2>
          <p className="mt-2 text-sm text-ink/60">
            {answeredCount} of {total} questions answered.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <button
              type="button"
              disabled={submitting || preview}
              onClick={onSubmit}
              title={preview ? "Responses aren't recorded in preview" : undefined}
              className="inline-flex items-center gap-2 rounded-full bg-brand px-8 py-3.5 text-base font-semibold text-brand-foreground shadow-lg shadow-brand/25 transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
            <button
              type="button"
              onClick={back}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-ink/40 hover:text-ink"
            >
              <ArrowLeft className="size-3.5" /> Back to questions
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
