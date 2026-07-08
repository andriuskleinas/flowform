import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import type { Database } from "@/integrations/supabase/types";

// ── Public types ──────────────────────────────────────────────────────────────

export type ResponseSummary = {
  summary: string;
  sentiment: "positive" | "mixed" | "negative";
  themes: { name: string; detail: string }[];
  quotes: string[];
  analyzed_count: number;
};

// ── Internal schemas ──────────────────────────────────────────────────────────

const inputSchema = z.object({ formId: z.string().uuid() });

const RawSummarySchema = z.object({
  summary: z.string().min(1).max(2000),
  sentiment: z.enum(["positive", "mixed", "negative"]),
  themes: z
    .array(z.object({ name: z.string().min(1).max(80), detail: z.string().min(1).max(300) }))
    .max(6),
  quotes: z.array(z.string().min(1).max(300)).max(4),
});

// Keep the prompt bounded no matter how many responses exist.
const MAX_ANSWERS = 300;
const MAX_PROMPT_CHARS = 60_000;

/**
 * RLS-scoped Supabase client for the calling user, built from the bearer
 * token that `attachSupabaseAuth` adds to serverFn requests. Env resolution
 * mirrors form-meta.ts (VITE_ vars are the ones present in all environments).
 */
function createUserScopedClient() {
  const url = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are not configured.");
  const authHeader = getRequest()?.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("You must be signed in to summarize responses.");
  }
  return createClient<Database>(url, key, {
    global: { headers: { Authorization: authHeader } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

// ── Server function ───────────────────────────────────────────────────────────

export const summarizeResponses = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth])
  .inputValidator(inputSchema)
  .handler(async ({ data }): Promise<ResponseSummary> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured on the server.");

    const supabase = createUserScopedClient();

    // RLS: only the owner can read these rows, so a foreign formId yields
    // "not found" rather than someone else's data.
    const { data: form, error: formErr } = await supabase
      .from("forms")
      .select("id, title")
      .eq("id", data.formId)
      .maybeSingle();
    if (formErr) throw formErr;
    if (!form) throw new Error("Form not found.");

    const { data: questions, error: qErr } = await supabase
      .from("questions")
      .select("id, label, type, position")
      .eq("form_id", data.formId)
      .in("type", ["text", "long_text"])
      .order("position", { ascending: true });
    if (qErr) throw qErr;
    if (!questions || questions.length === 0) {
      throw new Error("This form has no open-text questions to summarize.");
    }

    const { data: responses, error: rErr } = await supabase
      .from("responses")
      .select("answers")
      .eq("form_id", data.formId)
      .order("submitted_at", { ascending: false })
      .limit(1000);
    if (rErr) throw rErr;

    // Collect answers grouped by question, newest first, within budget.
    let collected = 0;
    let chars = 0;
    const byQuestion = questions.map((q) => ({ label: q.label, answers: [] as string[] }));
    outer: for (const r of responses ?? []) {
      const answers = (r.answers ?? {}) as Record<string, unknown>;
      for (let i = 0; i < questions.length; i++) {
        const v = answers[questions[i].id];
        if (typeof v !== "string") continue;
        const trimmed = v.trim();
        if (!trimmed) continue;
        const snippet = trimmed.slice(0, 500);
        byQuestion[i].answers.push(snippet);
        collected++;
        chars += snippet.length;
        if (collected >= MAX_ANSWERS || chars >= MAX_PROMPT_CHARS) break outer;
      }
    }
    if (collected === 0) throw new Error("No text answers yet — nothing to summarize.");

    const userContent =
      `Form title: ${form.title}\n\n` +
      byQuestion
        .filter((q) => q.answers.length > 0)
        .map(
          (q) =>
            `Question: ${q.label}\nAnswers (${q.answers.length}):\n` +
            q.answers.map((a) => `- ${a.replace(/\n+/g, " ")}`).join("\n"),
        )
        .join("\n\n");

    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Claude returned no text content.");
    }

    let parsed: unknown;
    try {
      const raw = textBlock.text
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/```\s*$/, "");
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Claude returned non-JSON output. Please try again.");
    }

    const validated = RawSummarySchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error("Claude returned an unexpected structure. Please try again.");
    }

    return { ...validated.data, analyzed_count: collected };
  });

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `\
You are an insights analyst for survey results. You will receive the open-text answers collected by a form, grouped by question. Analyze them and respond with ONLY a valid JSON object — no explanation, no markdown fences.

The JSON object must have exactly these fields:
- "summary": string — 2-4 sentences capturing what respondents are saying overall. Written for the form owner. Plain language, specific, no filler.
- "sentiment": "positive" | "mixed" | "negative" — the overall tone of the answers.
- "themes": array of 2-6 objects, each { "name": string (short label, max 6 words), "detail": string (one sentence: what respondents said about it, roughly how common it was) }. Order from most to least prominent.
- "quotes": array of 0-4 short verbatim quotes (max ~25 words each) that best illustrate the themes. Only use text that actually appears in the answers; trim but never rewrite.

If the answers are too few or too thin for a confident analysis, say so honestly in "summary" and return fewer themes.`;
