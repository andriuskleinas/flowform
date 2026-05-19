export type QuestionType = "text" | "multiple_choice" | "rating";

export type QuestionOptions = string[] | { max: number } | null;

/**
 * The value submitted for a single question.
 *
 * Runtime mapping (enforced by `isAnswered`, `validateAnswerLength`, and the
 * branches inside `QuestionRender`):
 *   - "text"            → string
 *   - "multiple_choice" → string[]   (some legacy responses may also be a
 *                                     single string; the renderer normalises)
 *   - "rating"          → number
 */
export type AnswerValue = string | string[] | number;

/**
 * Map of question.id → submitted answer.
 * Values are optional because a respondent may not have answered every
 * question yet (during in-progress form filling) or skipped questions in
 * already-submitted responses.
 */
export type Answers = Record<string, AnswerValue | undefined>;

export function isAnswered(
  question: { type: QuestionType },
  value: unknown,
): boolean {
  if (value === undefined || value === null) return false;
  if (question.type === "text")
    return typeof value === "string" && value.trim().length > 0;
  if (question.type === "multiple_choice")
    return Array.isArray(value)
      ? value.length > 0
      : typeof value === "string" && value.length > 0;
  if (question.type === "rating")
    return typeof value === "number" && value > 0;
  return false;
}

export function getRatingMax(options: QuestionOptions): number {
  if (!options || Array.isArray(options)) return 5;
  return (options as { max: number }).max;
}

/**
 * Structural equality for QuestionOptions. Much cheaper than two
 * JSON.stringify calls and not sensitive to key ordering — used on hot
 * paths like the editor's `isDirty` memo where it runs on every keystroke.
 */
export function questionOptionsEqual(a: QuestionOptions, b: QuestionOptions): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }
  if (!Array.isArray(a) && !Array.isArray(b) && typeof a === "object" && typeof b === "object") {
    return a.max === b.max;
  }
  return false;
}

export function getMcOptions(options: QuestionOptions): string[] {
  return Array.isArray(options) ? options : [];
}

export const MAX_ANSWER_LENGTH = 5000;

export function validateAnswerLength(value: unknown): boolean {
  if (typeof value === "string") return value.length <= MAX_ANSWER_LENGTH;
  if (Array.isArray(value))
    return value.every((v) => typeof v === "string" && v.length <= MAX_ANSWER_LENGTH);
  return true;
}
