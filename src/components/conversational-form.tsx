import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

import { QuestionRender, type Question } from "@/components/question-render";
import {
  getChoiceConfig,
  getRatingMax,
  isAnswered,
  resolveNextIndex,
  computeVisiblePath,
  type Answers,
  type AnswerValue,
} from "@/lib/form-utils";

/**
 * One-question-at-a-time respondent experience: progress bar, Enter to
 * advance, A–Z / 0–9 shortcuts, back navigation, and logic-jump routing. Selecting a choice only
 * records the answer — respondents always confirm with OK/Enter, so a
 * misclick can be corrected before moving on. Owns only navigation state —
 * answers live in the parent so persistence and submission stay in one place.
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
  // In preview there's no real submission — clicking Submit shows a "preview
  // complete" confirmation instead of a dead, disabled button.
  const [previewSubmitted, setPreviewSubmitted] = useState(false);

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
    setError(false);
    setPreviewSubmitted(false);
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
  };

  // A window-level listener (rather than onKeyDown on the container) so Enter
  // works regardless of focus — nothing in the form autofocuses, and clicking
  // a choice/rating button doesn't move focus at all in Safari.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key !== "Enter") {
        // Letter / number shortcuts, matching the lettered options on screen.
        // Never while the respondent is typing into a field.
        const typing =
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable;
        if (!current || typing || e.metaKey || e.ctrlKey || e.altKey) return;
        const value = shortcutAnswer(current, answers[current.id], e.key);
        if (value === undefined) return;
        e.preventDefault();
        handleAnswer(value);
        return;
      }
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
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (total === 0) {
    return (
      <p className="rounded-lg border border-dashed border-ink/15 bg-card/50 p-8 text-center text-ink/60">
        This form has no questions yet.
      </p>
    );
  }

  return (
    <div>
      <div
        className="h-0.5 w-full overflow-hidden bg-hairline"
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
              className="mb-6 inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 -ml-2 text-sm text-ink/55 transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <ArrowLeft className="size-4" /> Back
            </button>
          )}

          <p className="eyebrow">
            <span className="text-brand">{String(history.length + 1).padStart(2, "0")}</span>
            <span className="mx-1.5 text-ink/25">/</span>
            {String(total).padStart(2, "0")}
            {!current.required && <span className="ml-2 text-ink/40">· Optional</span>}
          </p>

          <div className="mt-4">
            <QuestionRender
              variant="conversational"
              question={current}
              value={answers[current.id]}
              onChange={handleAnswer}
            />
          </div>

          {error && (
            <p className="mt-4 text-sm font-medium text-destructive">
              This question needs an answer.
            </p>
          )}

          <div className="mt-8 flex items-center gap-4">
            <button
              type="button"
              onClick={advance}
              className="inline-flex h-11 items-center gap-2 rounded-md bg-brand px-6 text-[15px] font-medium text-brand-foreground transition-colors hover:bg-brand/90"
            >
              {current.required || isAnswered(current, answers[current.id]) ? "OK" : "Skip"}
            </button>
            <span className="hidden font-mono text-[11px] text-ink/45 sm:inline">
              {shortcutHint(current)}
            </span>
          </div>
        </div>
      )}

      {atSubmit && (
        <div className="mt-12 text-center motion-safe:animate-[demo-step-in_0.4s_ease-out_both]">
          <CheckCircle2 className="mx-auto size-10 text-brand" strokeWidth={1.5} />
          {preview && previewSubmitted ? (
            <>
              <h2 className="font-display mt-4 text-3xl">Preview complete</h2>
              <p className="mt-2 text-sm text-ink/60">
                In the live form this submits the response and shows your thank-you message. Nothing
                is recorded in preview.
              </p>
            </>
          ) : (
            <>
              <h2 className="font-display mt-4 text-3xl">You're all set</h2>
              <p className="mt-2 text-sm text-ink/60">
                {answeredCount} of {total} questions answered.
              </p>
            </>
          )}
          <div className="mt-8 flex flex-col items-center gap-3">
            {!(preview && previewSubmitted) && (
              <button
                type="button"
                disabled={submitting}
                onClick={preview ? () => setPreviewSubmitted(true) : onSubmit}
                className="inline-flex h-12 items-center gap-2 rounded-md bg-brand px-8 text-base font-medium text-brand-foreground transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Submitting…" : preview ? "Submit (preview)" : "Submit"}
              </button>
            )}
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

/**
 * Maps a key press to an answer for the current question: A–Z picks (or, for
 * multi-select, toggles) a lettered choice, Y/N answers yes/no, digits set an
 * NPS (0–9) or rating (1–max) score. Returns undefined when the key means nothing.
 */
function shortcutAnswer(
  question: Question,
  current: AnswerValue | undefined,
  key: string,
): AnswerValue | undefined {
  const k = key.toLowerCase();
  if (question.type === "yes_no") {
    if (k === "a" || k === "y") return "Yes";
    if (k === "b" || k === "n") return "No";
    return undefined;
  }
  if (question.type === "multiple_choice") {
    const i = /^[a-z]$/.test(k) ? k.charCodeAt(0) - 97 : -1;
    const { choices, multi } = getChoiceConfig(question.options);
    const opt = choices[i];
    if (i < 0 || opt === undefined) return undefined;
    if (!multi) return opt;
    const selected = Array.isArray(current)
      ? current
      : typeof current === "string" && current.length > 0
        ? [current]
        : [];
    return selected.includes(opt) ? selected.filter((x) => x !== opt) : [...selected, opt];
  }
  if (/^[0-9]$/.test(key)) {
    const n = Number(key);
    if (question.type === "nps") return n;
    if (question.type === "rating" && n >= 1 && n <= getRatingMax(question.options)) return n;
  }
  return undefined;
}

function shortcutHint(question: Question): string {
  switch (question.type) {
    case "long_text":
      return "⌘/Ctrl + Enter ↵";
    case "yes_no":
      return "press Y or N, then Enter ↵";
    case "multiple_choice": {
      const n = getChoiceConfig(question.options).choices.length;
      if (n === 0) return "press Enter ↵";
      const last = String.fromCharCode(64 + Math.min(n, 26));
      return n === 1 ? "press A, then Enter ↵" : `press A–${last}, then Enter ↵`;
    }
    case "nps":
      return "press 0–9, then Enter ↵";
    case "rating":
      return `press 1–${Math.min(getRatingMax(question.options), 9)}, then Enter ↵`;
    default:
      return "press Enter ↵";
  }
}
