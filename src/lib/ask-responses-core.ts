import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { getChoiceConfig, parseFollowUps, type QuestionOptions } from "@/lib/form-utils";
import type { FormSettings } from "@/lib/form-settings";

/**
 * Core of "Ask your responses", free of server/runtime imports so it can be
 * exercised directly. ask-responses.ts is the server function that loads the
 * data through the caller's RLS-scoped client.
 *
 * 1. Claude reads a catalog of the form's fields and calls `filter_responses`
 *    with a structured filter (strict tool schema).
 * 2. This code applies the filter itself (the model never decides which rows
 *    match) and returns the matching responses as the tool result.
 * 3. Claude answers the question from that subset.
 */

// ── Public types ──────────────────────────────────────────────────────────────

export type AskCondition = { label: string; op: FilterOp; value: string };

export type AskResult = {
  answer: string;
  highlights: string[];
  filter: { description: string; match: "all" | "any"; conditions: AskCondition[] };
  matchedIds: string[];
  matchedCount: number;
  total: number;
  /** True when the form has more responses than were searched. */
  capped: boolean;
};

// ── Internals ─────────────────────────────────────────────────────────────────

export const MAX_RESPONSES = 2000;
const MAX_RESULT_CHARS = 45_000;
const MAX_IDS = 200;

const OPS = [
  "equals",
  "not_equals",
  "contains",
  "gte",
  "lte",
  "answered",
  "not_answered",
  "after",
  "before",
] as const;
type FilterOp = (typeof OPS)[number];

const FilterSchema = z.object({
  description: z.string().max(300),
  match: z.enum(["all", "any"]),
  conditions: z
    .array(z.object({ field: z.string().max(80), op: z.enum(OPS), value: z.string().max(200) }))
    .max(8),
});
type Filter = z.infer<typeof FilterSchema>;

const AnswerSchema = z.object({
  answer: z.string().min(1).max(3000),
  highlights: z.array(z.string().max(300)).max(4).default([]),
});

export type AskQuestion = { id: string; label: string; type: string; options: QuestionOptions };
export type AskRow = {
  id: string;
  submitted_at: string;
  answers: Record<string, unknown>;
  follow_ups: unknown;
  meta: Record<string, unknown> | null;
  score: number | null;
  outcome: string | null;
};

function sourceOf(meta: AskRow["meta"]): string {
  const s = meta?.source ?? meta?.referrer;
  return typeof s === "string" && s ? s : "direct";
}

function choicesOf(q: AskQuestion): string[] {
  if (q.type === "yes_no") return ["Yes", "No"];
  if (q.type === "multiple_choice" || q.type === "dropdown")
    return getChoiceConfig(q.options).choices;
  return [];
}

/** Value of a catalog field for one response (undefined = no value). */
function fieldValue(row: AskRow, field: string, aliases: Map<string, AskQuestion>): unknown {
  const q = aliases.get(field);
  if (q) return row.answers?.[q.id];
  if (field === "source") return sourceOf(row.meta);
  if (field === "campaign" || field === "medium") return row.meta?.[field];
  if (field.startsWith("hidden.")) {
    const hidden = row.meta?.hidden as Record<string, unknown> | undefined;
    return hidden?.[field.slice(7)];
  }
  if (field === "score") return row.score ?? undefined;
  if (field === "outcome") return row.outcome ?? undefined;
  if (field === "submitted_at") return row.submitted_at;
  return undefined;
}

function isEmpty(v: unknown) {
  return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
}

function test(v: unknown, op: FilterOp, raw: string): boolean {
  const value = raw.trim().toLowerCase();
  const strs = Array.isArray(v)
    ? v.map((x) => String(x).toLowerCase())
    : isEmpty(v)
      ? []
      : [String(v).toLowerCase()];
  const num =
    typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  switch (op) {
    case "answered":
      return !isEmpty(v);
    case "not_answered":
      return isEmpty(v);
    case "equals":
      return strs.includes(value);
    case "not_equals":
      return !strs.includes(value);
    case "contains":
      return strs.some((s) => s.includes(value));
    case "gte":
      return Number.isFinite(num) && num >= Number(raw);
    case "lte":
      return Number.isFinite(num) && num <= Number(raw);
    case "after":
    case "before": {
      if (typeof v !== "string") return false;
      const t = Date.parse(v);
      const ref = Date.parse(raw);
      if (Number.isNaN(t) || Number.isNaN(ref)) return false;
      return op === "after" ? t >= ref : t < ref;
    }
  }
}

function applyFilter(rows: AskRow[], filter: Filter, aliases: Map<string, AskQuestion>): AskRow[] {
  const conds = filter.conditions;
  if (conds.length === 0) return rows;
  return rows.filter((r) => {
    const results = conds.map((c) => test(fieldValue(r, c.field, aliases), c.op, c.value));
    return filter.match === "any" ? results.some(Boolean) : results.every(Boolean);
  });
}

function fmt(v: unknown): string {
  if (isEmpty(v)) return "—";
  if (Array.isArray(v)) return v.join(", ");
  return String(v).replace(/\s+/g, " ").slice(0, 300);
}

export async function runAsk({
  client,
  formTitle,
  settings,
  questions,
  rows,
  question,
  capped,
}: {
  client: Anthropic;
  formTitle: string;
  settings: FormSettings;
  questions: AskQuestion[];
  rows: AskRow[];
  question: string;
  capped: boolean;
}): Promise<AskResult> {
  // Short aliases keep the prompt readable and stop Claude echoing uuids.
  const aliases = new Map(questions.map((q, i) => [`q${i + 1}`, q]));
  // ── Field catalog ──
  const hiddenFields = settings.hidden_fields ?? [];
  const sources = [...new Set(rows.map((r) => sourceOf(r.meta)))].slice(0, 15);
  const catalog = [
    ...[...aliases].map(([alias, q]) => {
      const choices = choicesOf(q);
      const extra =
        choices.length > 0
          ? ` choices: ${choices.map((c) => JSON.stringify(c)).join(", ")}`
          : q.type === "rating"
            ? ` (number 1–${(q.options as { max?: number } | null)?.max ?? 5})`
            : q.type === "nps"
              ? " (number 0–10)"
              : "";
      return `${alias} [${q.type}] "${q.label}"${extra}`;
    }),
    `source [text] traffic source; values seen: ${sources.join(", ")}`,
    "campaign [text] utm_campaign",
    ...hiddenFields.map((f) => `hidden.${f} [text] hidden field from the link`),
    ...(settings.quiz?.enabled
      ? [
          "score [number] quiz score",
          `outcome [id] quiz outcome; ids: ${settings.quiz.outcomes
            .map((o) => `${o.id} = "${o.title}"`)
            .join(", ")}`,
        ]
      : []),
    `submitted_at [date] ISO timestamp; today is ${new Date().toISOString().slice(0, 10)}`,
  ].join("\n");

  const tools: Anthropic.Beta.BetaTool[] = [
    {
      name: "filter_responses",
      description:
        "Select the survey responses relevant to the owner's question. The server applies the filter and returns the matching responses. Use no conditions when the question is about everyone.",
      strict: true,
      input_schema: {
        type: "object",
        additionalProperties: false,
        required: ["description", "match", "conditions"],
        properties: {
          description: {
            type: "string",
            description:
              "Plain-language description of who is selected, e.g. 'Respondents who rated delivery 2 or lower'. Use 'All responses' for no conditions.",
          },
          match: { type: "string", enum: ["all", "any"] },
          conditions: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["field", "op", "value"],
              properties: {
                field: {
                  type: "string",
                  description: "A field name from the catalog, e.g. q3, source, score, hidden.plan",
                },
                op: { type: "string", enum: [...OPS] },
                value: {
                  type: "string",
                  description:
                    "Comparison value. Exact choice text for equals on choice questions; a number for gte/lte; YYYY-MM-DD for after/before; empty string for answered/not_answered.",
                },
              },
            },
          },
        },
      },
    },
  ];

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: `Form: ${formTitle}\nResponses available: ${rows.length}\n\nFields:\n${catalog}\n\nOwner's question: ${question}`,
    },
  ];

  const call = (toolChoice: Anthropic.Beta.BetaToolChoice) =>
    client.beta.messages.create({
      model: "claude-sonnet-5-5",
      max_tokens: 16000,
      output_config: { effort: "medium" },
      // If a safety classifier declines, retry on a fallback model in the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      tools,
      tool_choice: toolChoice,
      messages,
    });

  const check = (m: Anthropic.Beta.BetaMessage) => {
    if (m.stop_reason === "refusal")
      throw new Error("Claude declined this question. Try rewording it.");
    if (m.stop_reason === "max_tokens")
      throw new Error("Claude's reply was cut off. Please try again.");
  };

  // Turn 1: Claude turns the question into a filter. Sonnet 5.5 can't be
  // forced to call a tool, so the prompt asks for it and `auto` allows it.
  const first = await call({ type: "auto" });
  check(first);
  const toolUse = first.content.find(
    (b): b is Anthropic.Beta.BetaToolUseBlock =>
      b.type === "tool_use" && b.name === "filter_responses",
  );

  let filter: Filter = { description: "All responses", match: "all", conditions: [] };
  let matched = rows;
  let final: Anthropic.Beta.BetaMessage = first;

  if (toolUse) {
    const parsed = FilterSchema.safeParse(toolUse.input);
    // Unknown fields are dropped rather than silently matching nothing.
    const known = (f: string) =>
      aliases.has(f) ||
      ["source", "campaign", "medium", "submitted_at"].includes(f) ||
      (f === "score" || f === "outcome" ? !!settings.quiz?.enabled : false) ||
      (f.startsWith("hidden.") && hiddenFields.includes(f.slice(7)));
    if (parsed.success) {
      filter = {
        ...parsed.data,
        conditions: parsed.data.conditions.filter((c) => known(c.field)),
      };
    }
    matched = applyFilter(rows, filter, aliases);

    // Tool result: the matching responses, compact, within budget.
    const lines: string[] = [];
    let chars = 0;
    for (const [i, r] of matched.entries()) {
      const fu = parseFollowUps(r.follow_ups);
      const parts = [...aliases]
        .filter(([, q]) => !isEmpty(r.answers[q.id]))
        .map(([alias, q]) => {
          const f = fu[q.id];
          return `${alias}: ${fmt(r.answers[q.id])}${f ? ` [follow-up: ${fmt(f.answer)}]` : ""}`;
        });
      const meta = [
        r.submitted_at.slice(0, 10),
        `source=${sourceOf(r.meta)}`,
        r.score != null ? `score=${r.score}` : "",
        r.outcome ? `outcome=${r.outcome}` : "",
      ]
        .filter(Boolean)
        .join(" ");
      const line = `#${i + 1} (${meta}) ${parts.join(" | ")}`;
      if (chars + line.length > MAX_RESULT_CHARS) break;
      lines.push(line);
      chars += line.length;
    }
    const resultText =
      `Matched ${matched.length} of ${rows.length} responses` +
      (lines.length < matched.length ? ` (showing the newest ${lines.length})` : "") +
      `.\n\n${lines.join("\n") || "(none)"}`;

    // Pass the assistant turn back unchanged (thinking/fallback blocks included).
    messages.push({ role: "assistant", content: first.content });
    messages.push({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: toolUse.id, content: resultText }],
    });

    // Turn 2: answer from the matched subset. No further tool calls.
    final = await call({ type: "none" });
    check(final);
  }

  const text = final.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  let answer: z.infer<typeof AnswerSchema>;
  try {
    const raw = text.replace(/^```json\s*/i, "").replace(/```\s*$/, "");
    const start = raw.indexOf("{");
    answer = AnswerSchema.parse(JSON.parse(raw.slice(start, raw.lastIndexOf("}") + 1)));
  } catch {
    if (!text) throw new Error("Claude returned no answer. Please try again.");
    answer = { answer: text.slice(0, 3000), highlights: [] };
  }

  const labelFor = (field: string) => {
    const q = aliases.get(field);
    if (q) return q.label;
    if (field.startsWith("hidden.")) return field.slice(7);
    return field.replace("_", " ");
  };
  const outcomeTitle = (id: string) =>
    settings.quiz?.outcomes.find((o) => o.id === id)?.title ?? id;

  return {
    answer: answer.answer,
    highlights: answer.highlights,
    filter: {
      description: filter.description,
      match: filter.match,
      conditions: filter.conditions.map((c) => ({
        label: labelFor(c.field),
        op: c.op,
        value: c.field === "outcome" ? outcomeTitle(c.value) : c.value,
      })),
    },
    matchedIds: matched.slice(0, MAX_IDS).map((r) => r.id),
    matchedCount: matched.length,
    total: rows.length,
    capped,
  };
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `\
You help a survey owner explore their responses. You get the form's field catalog and the owner's question.

Step 1: always call filter_responses exactly once to select the responses the question is about. Use the field names from the catalog. For choice questions use "equals" with the exact choice text. For "unhappy", "low rating", "detractors" and similar, translate into numeric conditions (for NPS, detractors are 0–6, passives 7–8, promoters 9–10). For questions about everyone, or that compare groups, pass no conditions and do the comparison yourself in step 2.

Step 2: you get the matching responses back. Answer the owner's question from them only. Be specific: give counts and percentages of the matched set where useful, and name patterns in the text answers. If the matched set is empty or too small to say much, say so plainly.

Reply in step 2 with ONLY a JSON object, no markdown fences:
{"answer": "2–5 sentences in plain language, written to the owner", "highlights": ["up to 3 short verbatim quotes from text answers that support the answer"]}
Only quote text that appears in the responses. Never invent numbers.`;
