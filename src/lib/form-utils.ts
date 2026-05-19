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
