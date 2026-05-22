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
  type: z.enum(["text", "multiple_choice", "rating"]),
  options: z
    .union([
      z.array(z.string()),
      z.object({ max: z.number().int().min(3).max(10) }),
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
  raw: string[] | { max: number } | null | undefined,
): QuestionOptions {
  if (type === "text") return null;
  if (type === "rating") {
    if (raw && !Array.isArray(raw) && "max" in raw) return { max: raw.max };
    return { max: 5 };
  }
  if (type === "multiple_choice") {
    if (Array.isArray(raw) && raw.length >= 2) return raw.slice(0, 8);
    return ["Option 1", "Option 2"];
  }
  return null;
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `\
You are a form-design assistant. Given a form title and optional description, suggest 5 to 8 survey questions that would be useful for that form.

Return ONLY a valid JSON array. Do not add any explanation, markdown fences, or text before or after the JSON.

Each element in the array must be a JSON object with these fields:
- "label": string — the question text (clear, concise, under 150 characters)
- "type": one of "text" | "multiple_choice" | "rating"
- "options": depends on type:
    - if type is "text": null
    - if type is "multiple_choice": an array of 2-5 non-empty strings
    - if type is "rating": an object with a single key "max" (integer 3-10), e.g. {"max": 5}

Guidelines for choosing type:
- Use "text" for open-ended questions (e.g. "What could we improve?")
- Use "multiple_choice" when there are a fixed set of natural answers (e.g. "How did you hear about us?")
- Use "rating" for satisfaction / likelihood / frequency questions

Example output (for a customer feedback form):
[
  {"label": "How satisfied are you with our service overall?", "type": "rating", "options": {"max": 5}},
  {"label": "How likely are you to recommend us to a friend?", "type": "rating", "options": {"max": 10}},
  {"label": "What did you enjoy most about your experience?", "type": "text", "options": null},
  {"label": "How did you hear about us?", "type": "multiple_choice", "options": ["Social media", "Word of mouth", "Search engine", "Advertisement", "Other"]},
  {"label": "How often do you use our service?", "type": "multiple_choice", "options": ["First time", "Occasionally", "Regularly", "Daily"]},
  {"label": "What could we do better?", "type": "text", "options": null}
]`;
