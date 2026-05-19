import { Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  type QuestionType,
  type QuestionOptions,
  type AnswerValue,
  getRatingMax,
} from "@/lib/form-utils";

export type { QuestionType, QuestionOptions, AnswerValue };

export type Question = {
  id: string;
  form_id: string;
  type: QuestionType;
  label: string;
  options: QuestionOptions;
  position: number;
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

      {question.type === "multiple_choice" &&
        (() => {
          const selected: string[] = Array.isArray(value)
            ? value
            : typeof value === "string" && value.length > 0
              ? [value]
              : [];
          const opts = Array.isArray(question.options) ? question.options : [];
          if (opts.length === 0) {
            return <p className="text-sm text-ink/40">No options yet</p>;
          }
          return (
            <div className="space-y-2">
              {opts.map((opt: string, i: number) => {
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
            </div>
          );
        })()}

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
