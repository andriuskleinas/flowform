import { Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  type QuestionType,
  type QuestionOptions,
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
};

type Props = {
  question: Question;
  value: AnswerValue | undefined;
  onChange?: (v: AnswerValue) => void;
  disabled?: boolean;
};

export function QuestionRender({ question, value, onChange, disabled }: Props) {
  const id = `q-${question.id}`;
  return (
    <div className="space-y-3">
      <Label htmlFor={id} className="text-base font-semibold text-ink">
        {question.label || <span className="italic text-ink/40">Untitled question</span>}
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
              className="flex h-10 w-full max-w-sm rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
}: {
  value: number | null;
  onChange?: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div>
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
                "flex size-9 items-center justify-center rounded-lg border text-sm font-semibold transition-colors disabled:cursor-default " +
                (active
                  ? "border-brand bg-brand text-brand-foreground"
                  : "border-ink/15 bg-white text-ink hover:border-brand/50 hover:bg-brand/5")
              }
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex max-w-[29rem] justify-between text-xs text-ink/40">
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
            className="rounded p-1 text-amber-500 transition-transform hover:scale-110 disabled:cursor-default disabled:hover:scale-100"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
          >
            <Star
              style={{ width: size, height: size }}
              className={filled ? "fill-amber-400 stroke-amber-500" : "stroke-ink/30"}
            />
          </button>
        );
      })}
    </div>
  );
}
