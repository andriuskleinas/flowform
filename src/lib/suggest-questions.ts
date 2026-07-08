import { createServerFn } from "@tanstack/react-start";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import type { QuestionType, QuestionOptions } from "@/lib/form-utils";

// ── Public types ──────────────────────────────────────────────────────────────

export type SuggestedQuestion = {
  id: string;
  label: string;
  type: QuestionType;
  options: QuestionOptions;
};

// ── Internal Zod schemas ──────────────────────────────────────────────────────

const RawSuggestionSchema = z.object({
  label: z.string().min(1).max(300),
  type: z.enum(["text", "long_text", "multiple_choice", "dropdown", "yes_no", "nps", "rating"]),
  options: z
    .union([
      z.array(z.string()),
      z.object({ max: z.number().int().min(3).max(10) }),
      z.object({ choices: z.array(z.string()), multi: z.boolean() }),
      z.null(),
    ])
    .optional()
    .nullable(),
});

const RawSuggestionsSchema = z.array(RawSuggestionSchema).min(1).max(12);

const inputSchema = z.object({
  title: z.string().max(120),
  description: z.string().max(500),
});

// ── Server function ───────────────────────────────────────────────────────────

export const suggestQuestions = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth])
  .inputValidator(inputSchema)
  .handler(async ({ data }): Promise<SuggestedQuestion[]> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not configured on the server.");
    }

    const client = new Anthropic({ apiKey });

    const userContent =
      `Form title: ${data.title || "(untitled)"}` +
      (data.description?.trim() ? `\nDescription: ${data.description.trim()}` : "");

    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Claude returned no text content.");
    }

    let parsed: unknown;
    try {
      // Strip markdown fences just in case, despite instructions
      const raw = textBlock.text
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/```\s*$/, "");
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Claude returned non-JSON output. Please try again.");
    }

    const validated = RawSuggestionsSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error("Claude returned unexpected question structure. Please try again.");
    }

    return validated.data.map((q) => ({
      id: crypto.randomUUID(),
      label: q.label,
      type: q.type,
      options: resolveOptions(q.type, q.options ?? null),
    }));
  });

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveOptions(
  type: QuestionType,
  raw: string[] | { max: number } | { choices: string[]; multi: boolean } | null | undefined,
): QuestionOptions {
  if (type === "rating") {
    if (raw && !Array.isArray(raw) && "max" in raw) return { max: raw.max };
    return { max: 5 };
  }
  if (type === "multiple_choice") {
    if (raw && !Array.isArray(raw) && "choices" in raw && raw.choices.length >= 2) {
      return { choices: raw.choices.slice(0, 8), multi: raw.multi };
    }
    if (Array.isArray(raw) && raw.length >= 2) return { choices: raw.slice(0, 8), multi: false };
    return { choices: ["Option 1", "Option 2"], multi: false };
  }
  if (type === "dropdown") {
    if (Array.isArray(raw) && raw.length >= 2) return raw.slice(0, 12);
    if (raw && !Array.isArray(raw) && "choices" in raw && raw.choices.length >= 2) {
      return raw.choices.slice(0, 12);
    }
    return ["Option 1", "Option 2"];
  }
  // text, long_text, yes_no, nps carry no options payload.
  return null;
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `\
You are a form-design assistant. Given a form title and optional description, suggest 5 to 8 survey questions that would be useful for that form.

Return ONLY a valid JSON array. Do not add any explanation, markdown fences, or text before or after the JSON.

Each element in the array must be a JSON object with these fields:
- "label": string — the question text (clear, concise, under 150 characters)
- "type": one of "text" | "long_text" | "multiple_choice" | "dropdown" | "yes_no" | "nps" | "rating"
- "options": depends on type:
    - if type is "text", "long_text", "yes_no", or "nps": null
    - if type is "multiple_choice": an object {"choices": [2-5 non-empty strings], "multi": boolean} — set "multi" true only when picking several answers makes sense
    - if type is "dropdown": an array of 3-10 non-empty strings
    - if type is "rating": an object with a single key "max" (integer 3-10), e.g. {"max": 5}

Guidelines for choosing type:
- Use "text" for short open-ended answers, "long_text" when a detailed answer is expected (e.g. "What could we improve?")
- Use "multiple_choice" when there is a small fixed set of natural answers (e.g. "How did you hear about us?")
- Use "dropdown" when the list of options is long (countries, departments, age brackets)
- Use "yes_no" for binary questions
- Use "nps" exactly for "How likely are you to recommend…" questions (0-10 scale)
- Use "rating" for satisfaction / quality / frequency questions

Example output (for a customer feedback form):
[
  {"label": "How satisfied are you with our service overall?", "type": "rating", "options": {"max": 5}},
  {"label": "How likely are you to recommend us to a friend?", "type": "nps", "options": null},
  {"label": "Did our product meet your expectations?", "type": "yes_no", "options": null},
  {"label": "How did you hear about us?", "type": "multiple_choice", "options": {"choices": ["Social media", "Word of mouth", "Search engine", "Advertisement", "Other"], "multi": false}},
  {"label": "Which features do you use regularly?", "type": "multiple_choice", "options": {"choices": ["Dashboards", "Reports", "Integrations", "Mobile app"], "multi": true}},
  {"label": "What could we do better?", "type": "long_text", "options": null}
]`;
