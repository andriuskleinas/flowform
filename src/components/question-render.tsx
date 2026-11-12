import { Check, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  type QuestionType,
  type QuestionOptions,
  type QuestionLogic,
  type AnswerValue,
  getRatingMax,
  getChoiceConfig,
} from "@/lib/form-utils";

export type { QuestionType, QuestionOptions, AnswerValue };

export type Question = {
  id: string;
  form_id: string;
  type: QuestionType;
  label: string;
  options: QuestionOptions;
  position: number;
  required: boolean;
  /** Optional — routes that don't need jump rules may omit it from their select. */
  logic?: QuestionLogic;
  /** Conversational mode asks one AI follow-up on thin text answers. */
  ai_follow_up?: boolean;
  /** Variable name later labels can recall this answer by: "Thanks, {name}!". */
  recall_key?: string | null;
  /** Quiz points per choice ({ "Paris": 1 }). */
  points?: Record<string, number> | null;
};

type Props = {
  question: Question;
  value: AnswerValue | undefined;
  onChange?: (v: AnswerValue) => void;
  disabled?: boolean;
  /**
   * "conversational" is the one-question-at-a-time view: the question is the
   * hero (display serif) and choices become large lettered options.
   */
  variant?: "default" | "conversational";
};

export function QuestionRender({
  question,
  value,
  onChange,
  disabled,
  variant = "default",
}: Props) {
  const id = `q-${question.id}`;
  const big = variant === "conversational";
  const label = question.label || <span className="italic text-ink/40">Untitled question</span>;

  if (big) {
    return (
      <div>
        <Label
          htmlFor={id}
          id={`${id}-label`}
          className="block font-display text-[1.6rem] leading-[1.1] text-balance text-ink md:text-[2.1rem]"
        >
          {label}
        </Label>
        <div className="mt-7">
          <BigAnswer
            id={id}
            question={question}
            value={value}
            onChange={onChange}
            disabled={disabled}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Label htmlFor={id} className="text-[15px] font-medium text-ink">
        {label}
      </Label>

      {question.type === "text" && (
        <Input
          id={id}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          placeholder="Your answer"
        />
      )}

      {question.type === "long_text" && (
        <Textarea
          id={id}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          rows={4}
          placeholder="Your answer"
        />
      )}

      {question.type === "multiple_choice" && (
        <ChoiceInput
          id={id}
          options={question.options}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      )}

      {question.type === "dropdown" &&
        (() => {
          const { choices } = getChoiceConfig(question.options);
          if (choices.length === 0) {
            return <p className="text-sm text-ink/40">No options yet</p>;
          }
          return (
            <select
              id={id}
              value={typeof value === "string" ? value : ""}
              onChange={(e) => onChange?.(e.target.value)}
              disabled={disabled}
              className="flex h-10 w-full max-w-sm rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="" disabled>
                Select an option…
              </option>
              {choices.map((opt, i) => (
                <option key={i} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          );
        })()}

      {question.type === "yes_no" && (
        <RadioGroup
          value={typeof value === "string" ? value : ""}
          onValueChange={(v) => onChange?.(v)}
          disabled={disabled}
          className="flex gap-6"
        >
          {["Yes", "No"].map((opt) => (
            <div key={opt} className="flex items-center gap-2.5">
              <RadioGroupItem id={`${id}-${opt}`} value={opt} />
              <Label htmlFor={`${id}-${opt}`} className="font-normal">
                {opt}
              </Label>
            </div>
          ))}
        </RadioGroup>
      )}

      {question.type === "nps" && (
        <NpsScale
          value={typeof value === "number" ? value : null}
          onChange={(n) => onChange?.(n)}
          disabled={disabled}
        />
      )}

      {question.type === "rating" && (
        <StarRating
          max={getRatingMax(question.options)}
          value={typeof value === "number" ? value : 0}
          onChange={(n) => onChange?.(n)}
          disabled={disabled}
        />
      )}
    </div>
  );
}

function ChoiceInput({
  id,
  options,
  value,
  onChange,
  disabled,
}: {
  id: string;
  options: QuestionOptions;
  value: AnswerValue | undefined;
  onChange?: (v: AnswerValue) => void;
  disabled?: boolean;
}) {
  const { choices, multi } = getChoiceConfig(options);
  if (choices.length === 0) {
    return <p className="text-sm text-ink/40">No options yet</p>;
  }

  if (!multi) {
    return (
      <RadioGroup
        value={typeof value === "string" ? value : ""}
        onValueChange={(v) => onChange?.(v)}
        disabled={disabled}
        className="space-y-1"
      >
        {choices.map((opt, i) => (
          <div key={i} className="flex items-center gap-3">
            <RadioGroupItem id={`${id}-${i}`} value={opt} />
            <Label htmlFor={`${id}-${i}`} className="font-normal">
              {opt || <span className="italic text-ink/40">Option {i + 1}</span>}
            </Label>
          </div>
        ))}
      </RadioGroup>
    );
  }

  const selected: string[] = Array.isArray(value)
    ? value
    : typeof value === "string" && value.length > 0
      ? [value]
      : [];
  return (
    <div className="space-y-2">
      {choices.map((opt, i) => {
        const checked = selected.includes(opt);
        return (
          <div key={i} className="flex items-center gap-3">
            <Checkbox
              id={`${id}-${i}`}
              checked={checked}
              disabled={disabled}
              onCheckedChange={(c) => {
                if (!onChange) return;
                const next = c ? [...selected, opt] : selected.filter((x) => x !== opt);
                onChange(next);
              }}
            />
            <Label htmlFor={`${id}-${i}`} className="font-normal">
              {opt || <span className="italic text-ink/40">Option {i + 1}</span>}
            </Label>
          </div>
        );
      })}
      <p className="text-xs text-ink/40">Select all that apply</p>
    </div>
  );
}

export function NpsScale({
  value,
  onChange,
  disabled,
  big = false,
}: {
  value: number | null;
  onChange?: (n: number) => void;
  disabled?: boolean;
  big?: boolean;
}) {
  return (
    <div className={big ? "max-w-2xl" : undefined}>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 11 }).map((_, n) => {
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onChange?.(n)}
              aria-label={`${n} out of 10`}
              aria-pressed={active}
              className={
                (big
                  ? "flex h-12 min-w-11 flex-1 items-center justify-center rounded-md border font-mono text-base transition-colors disabled:cursor-default "
                  : "flex size-9 items-center justify-center rounded-md border font-mono text-sm transition-colors disabled:cursor-default ") +
                (active
                  ? "border-brand bg-brand text-brand-foreground"
                  : "border-input bg-card text-ink hover:border-ink/40")
              }
            >
              {n}
            </button>
          );
        })}
      </div>
      <div
        className={`mt-2 flex justify-between font-mono text-[11px] text-ink/45 ${big ? "" : "max-w-[29rem]"}`}
      >
        <span>Not at all likely</span>
        <span>Extremely likely</span>
      </div>
    </div>
  );
}

export function StarRating({
  max,
  value,
  onChange,
  disabled,
  size = 28,
}: {
  max: number;
  value: number;
  onChange?: (n: number) => void;
  disabled?: boolean;
  size?: number;
}) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }).map((_, i) => {
        const n = i + 1;
        const filled = n <= value;
        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onChange?.(n)}
            className="rounded-sm p-1 transition-opacity hover:opacity-80 disabled:cursor-default disabled:hover:opacity-100"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
          >
            <Star
              style={{ width: size, height: size }}
              strokeWidth={1.5}
              className={filled ? "fill-gold stroke-gold" : "stroke-ink/25"}
            />
          </button>
        );
      })}
    </div>
  );
}

/** Large lettered option, used for choice and yes/no in conversational mode. */
function OptionButton({
  index,
  label,
  selected,
  multi,
  disabled,
  onClick,
}: {
  index: number;
  label: React.ReactNode;
  selected: boolean;
  multi?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role={multi ? "checkbox" : "radio"}
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full max-w-xl items-center gap-3 rounded-md border px-3.5 py-3 text-left text-base transition-colors disabled:cursor-default ${
        selected
          ? "border-brand bg-accent text-ink"
          : "border-input bg-card text-ink/80 hover:border-ink/35"
      }`}
    >
      <span
        className={`grid size-6 shrink-0 place-items-center rounded-sm border font-mono text-[11px] ${
          selected ? "border-brand bg-brand text-white" : "border-ink/15 text-ink/50"
        }`}
      >
        {String.fromCharCode(65 + (index % 26))}
      </span>
      <span className="flex-1">{label}</span>
      {selected && <Check className="size-4 text-brand" strokeWidth={2.5} />}
    </button>
  );
}

function BigAnswer({
  id,
  question,
  value,
  onChange,
  disabled,
}: {
  id: string;
  question: Question;
  value: AnswerValue | undefined;
  onChange?: (v: AnswerValue) => void;
  disabled?: boolean;
}) {
  switch (question.type) {
    case "text":
      return (
        <Input
          id={id}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          placeholder="Type your answer…"
          className="h-12 max-w-xl bg-card px-4 text-lg md:text-lg"
        />
      );
    case "long_text":
      return (
        <Textarea
          id={id}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          rows={5}
          placeholder="Type your answer…"
          className="max-w-xl bg-card px-4 py-3 text-lg md:text-lg"
        />
      );
    case "multiple_choice": {
      const { choices, multi } = getChoiceConfig(question.options);
      if (choices.length === 0) return <p className="text-sm text-ink/40">No options yet</p>;
      const selected: string[] = Array.isArray(value)
        ? value
        : typeof value === "string" && value.length > 0
          ? [value]
          : [];
      return (
        <div
          role={multi ? "group" : "radiogroup"}
          aria-labelledby={`${id}-label`}
          className="grid gap-2"
        >
          {choices.map((opt, i) => (
            <OptionButton
              key={i}
              index={i}
              multi={multi}
              disabled={disabled}
              selected={multi ? selected.includes(opt) : value === opt}
              label={opt || <span className="italic text-ink/40">Option {i + 1}</span>}
              onClick={() => {
                if (!onChange) return;
                if (!multi) return onChange(opt);
                onChange(
                  selected.includes(opt) ? selected.filter((x) => x !== opt) : [...selected, opt],
                );
              }}
            />
          ))}
          {multi && <p className="mt-1 font-mono text-[11px] text-ink/45">Select all that apply</p>}
        </div>
      );
    }
    case "dropdown": {
      const { choices } = getChoiceConfig(question.options);
      if (choices.length === 0) return <p className="text-sm text-ink/40">No options yet</p>;
      return (
        <select
          id={id}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          className="flex h-12 w-full max-w-xl rounded-md border border-input bg-card px-4 text-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="" disabled>
            Select an option…
          </option>
          {choices.map((opt, i) => (
            <option key={i} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }
    case "yes_no":
      return (
        <div role="radiogroup" aria-labelledby={`${id}-label`} className="grid max-w-xl gap-2">
          {["Yes", "No"].map((opt, i) => (
            <OptionButton
              key={opt}
              index={i}
              disabled={disabled}
              selected={value === opt}
              label={opt}
              onClick={() => onChange?.(opt)}
            />
          ))}
        </div>
      );
    case "nps":
      return (
        <NpsScale
          big
          value={typeof value === "number" ? value : null}
          onChange={(n) => onChange?.(n)}
          disabled={disabled}
        />
      );
    case "rating":
      return (
        <StarRating
          size={36}
          max={getRatingMax(question.options)}
          value={typeof value === "number" ? value : 0}
          onChange={(n) => onChange?.(n)}
          disabled={disabled}
        />
      );
    default:
      return null;
  }
}
