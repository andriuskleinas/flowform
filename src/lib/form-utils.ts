export type QuestionType =
  | "text"
  | "long_text"
  | "multiple_choice"
  | "dropdown"
  | "yes_no"
  | "nps"
  | "rating";

/** Form lifecycle: draft (owner-only) → published (live) → closed (visible, not accepting). */
export type FormStatus = "draft" | "published" | "closed";

/** How respondents experience the form: one question at a time, or a single page. */
export type DisplayMode = "conversational" | "classic";

/**
 * Logic-jump rules for a question. `jumps` maps a choice value to the id of a
 * LATER question, or the sentinel "end" (skip to submit). Only single-choice
 * questions (single-select multiple_choice, dropdown, yes_no) carry rules.
 */
export type QuestionLogic = { jumps?: Record<string, string> } | null;

export const JUMP_TO_END = "end";

export function logicEqual(a: QuestionLogic | undefined, b: QuestionLogic | undefined): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

type LogicCarrier = { id: string; logic?: QuestionLogic };

/**
 * Index of the question shown after answering `questions[idx]`, following a
 * matching jump rule when the answer is a single choice. Returns
 * `questions.length` for "end of form". Jumps are forward-only; stale or
 * backward targets fall through to the next question so a bad rule can never
 * trap a respondent in a loop.
 */
export function resolveNextIndex(questions: LogicCarrier[], idx: number, answer: unknown): number {
  const jumps = questions[idx]?.logic?.jumps;
  if (jumps && typeof answer === "string" && jumps[answer]) {
    const target = jumps[answer];
    if (target === JUMP_TO_END) return questions.length;
    const ti = questions.findIndex((q) => q.id === target);
    if (ti > idx) return ti;
  }
  return idx + 1;
}

/**
 * The indices a respondent actually visits given their answers, following
 * jump rules from the top. Used to validate only the questions on the path —
 * a required question skipped by a jump must not block submission.
 */
export function computeVisiblePath(
  questions: LogicCarrier[],
  answers: Record<string, unknown>,
): number[] {
  const path: number[] = [];
  let idx = 0;
  while (idx < questions.length && path.length <= questions.length) {
    path.push(idx);
    idx = resolveNextIndex(questions, idx, answers[questions[idx].id]);
  }
  return path;
}

/** Rating scales offered in the builders. Keep create + edit pages in sync. */
export const RATING_MAX_CHOICES = [3, 4, 5, 6, 7, 8, 9, 10] as const;

/** Display names for question types — single source for builder selects. */
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  text: "Short answer",
  long_text: "Long answer",
  multiple_choice: "Multiple choice",
  dropdown: "Dropdown",
  yes_no: "Yes / No",
  nps: "NPS (0–10)",
  rating: "Rating scale",
};

/**
 * Per-type options payload:
 *   - text / long_text / yes_no / nps → null
 *   - rating                         → { max: number }
 *   - dropdown                       → string[] (the choices)
 *   - multiple_choice                → { choices: string[], multi: boolean }
 *                                      Legacy rows are plain string[] and mean
 *                                      multi-select (checkbox behavior predates
 *                                      the multi flag).
 */
export type QuestionOptions = string[] | { max: number } | ChoiceConfig | null;

export type ChoiceConfig = { choices: string[]; multi: boolean };

/**
 * Normalizes any choice-carrying options shape (multiple_choice legacy array,
 * multiple_choice object, dropdown array) into { choices, multi }.
 */
export function getChoiceConfig(options: QuestionOptions): ChoiceConfig {
  if (Array.isArray(options)) return { choices: options, multi: true };
  if (options && typeof options === "object" && "choices" in options) {
    return { choices: options.choices, multi: options.multi ?? true };
  }
  return { choices: [], multi: false };
}

export function defaultOptionsForType(type: QuestionType): QuestionOptions {
  if (type === "multiple_choice") return { choices: ["Option 1", "Option 2"], multi: false };
  if (type === "dropdown") return ["Option 1", "Option 2"];
  if (type === "rating") return { max: 5 };
  return null;
}

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

export function isAnswered(question: { type: QuestionType }, value: unknown): boolean {
  if (value === undefined || value === null) return false;
  switch (question.type) {
    case "text":
    case "long_text":
      return typeof value === "string" && value.trim().length > 0;
    case "multiple_choice":
      return Array.isArray(value)
        ? value.length > 0
        : typeof value === "string" && value.length > 0;
    case "dropdown":
    case "yes_no":
      return typeof value === "string" && value.length > 0;
    case "nps":
      // 0 is a legitimate NPS answer — only undefined/null means unanswered.
      return typeof value === "number" && value >= 0;
    case "rating":
      return typeof value === "number" && value > 0;
    default:
      return false;
  }
}

export function getRatingMax(options: QuestionOptions): number {
  if (!options || Array.isArray(options) || !("max" in options)) return 5;
  return options.max;
}

/**
 * Structural equality for QuestionOptions. Much cheaper than two
 * JSON.stringify calls and not sensitive to key ordering — used on hot
 * paths like the editor's `isDirty` memo where it runs on every keystroke.
 */
function isChoiceish(o: QuestionOptions): boolean {
  return Array.isArray(o) || (o != null && typeof o === "object" && "choices" in o);
}

export function questionOptionsEqual(a: QuestionOptions, b: QuestionOptions): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  // Choice-carrying shapes compare by normalized { choices, multi } so a
  // legacy string[] equals its { choices, multi: true } object form.
  if (isChoiceish(a) && isChoiceish(b)) {
    const ca = getChoiceConfig(a);
    const cb = getChoiceConfig(b);
    if (ca.multi !== cb.multi || ca.choices.length !== cb.choices.length) return false;
    for (let i = 0; i < ca.choices.length; i++) if (ca.choices[i] !== cb.choices[i]) return false;
    return true;
  }
  if (isChoiceish(a) || isChoiceish(b)) return false;
  if (typeof a === "object" && typeof b === "object") {
    return (a as { max: number }).max === (b as { max: number }).max;
  }
  return false;
}

export const MAX_ANSWER_LENGTH = 5000;

export function validateAnswerLength(value: unknown): boolean {
  if (typeof value === "string") return value.length <= MAX_ANSWER_LENGTH;
  if (Array.isArray(value))
    return value.every((v) => typeof v === "string" && v.length <= MAX_ANSWER_LENGTH);
  return true;
}
