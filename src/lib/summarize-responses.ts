import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import type { Database } from "@/integrations/supabase/types";
import { parseFollowUps } from "@/lib/form-utils";

// ── Public types ──────────────────────────────────────────────────────────────

export type ResponseSummary = {
  summary: string;
  sentiment: "positive" | "mixed" | "negative";
  themes: { name: string; detail: string }[];
  quotes: string[];
  analyzed_count: number;
};

// ── Internal schemas ──────────────────────────────────────────────────────────

const inputSchema = z.object({
  formId: z.string().uuid(),
  /** Limit to one survey version (see form versioning); omitted = all versions. */
  version: z.number().int().positive().optional(),
});

type TextQuestion = { id: string; label: string };

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
    throw new Error("Log in to summarise responses.");
  }
  return createClient<Database>(url, key, {
    global: { headers: { Authorization: authHeader } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Open-text questions to summarize. The current version's live questions,
 * plus (for "all versions") text questions that earlier versions asked and the
 * current one dropped, from their snapshots. A single past version uses its
 * own snapshot so labels match what those respondents saw.
 */
async function loadTextQuestions(
  supabase: ReturnType<typeof createUserScopedClient>,
  formId: string,
  currentVersion: number,
  version: number | undefined,
): Promise<TextQuestion[]> {
  const isText = (t: unknown) => t === "text" || t === "long_text";

  const { data: snapshots, error: vErr } = await supabase
    .from("form_versions")
    .select("version, questions")
    .eq("form_id", formId)
    .order("version", { ascending: false });
  if (vErr) throw vErr;
  const fromSnapshot = (qs: unknown): TextQuestion[] =>
    (Array.isArray(qs) ? (qs as { id: string; label: string; type: string }[]) : [])
      .filter((q) => isText(q.type))
      .map((q) => ({ id: q.id, label: q.label }));

  if (version != null && version !== currentVersion) {
    const snap = snapshots?.find((v) => v.version === version);
    return snap ? fromSnapshot(snap.questions) : [];
  }

  const { data: live, error: qErr } = await supabase
    .from("questions")
    .select("id, label, type, position")
    .eq("form_id", formId)
    .in("type", ["text", "long_text"])
    .order("position", { ascending: true });
  if (qErr) throw qErr;
  const current = (live ?? []).map((q) => ({ id: q.id, label: q.label }));
  if (version != null) return current;

  const seen = new Set(current.map((q) => q.id));
  const retired: TextQuestion[] = [];
  for (const snap of snapshots ?? []) {
    for (const q of fromSnapshot(snap.questions)) {
      if (seen.has(q.id)) continue;
      seen.add(q.id);
      retired.push(q);
    }
  }
  return [...current, ...retired];
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
      .select("id, title, version")
      .eq("id", data.formId)
      .maybeSingle();
    if (formErr) throw formErr;
    if (!form) throw new Error("Form not found.");

    const questions = await loadTextQuestions(supabase, data.formId, form.version, data.version);
    if (questions.length === 0) {
      throw new Error(
        data.version != null
          ? `Version ${data.version} has no open-text questions to summarize.`
          : "This form has no open-text questions to summarise.",
      );
    }

    let responsesQuery = supabase
      .from("responses")
      .select("answers, follow_ups")
      .eq("form_id", data.formId);
    if (data.version != null) responsesQuery = responsesQuery.eq("form_version", data.version);
    const { data: responses, error: rErr } = await responsesQuery
      .order("submitted_at", { ascending: false })
      .limit(1000);
    if (rErr) throw rErr;

    // Collect answers grouped by question, newest first, within budget.
    let collected = 0;
    let chars = 0;
    const byQuestion = questions.map((q) => ({ label: q.label, answers: [] as string[] }));
    outer: for (const r of responses ?? []) {
      const answers = (r.answers ?? {}) as Record<string, unknown>;
      const followUps = parseFollowUps(r.follow_ups);
      for (let i = 0; i < questions.length; i++) {
        const v = answers[questions[i].id];
        if (typeof v !== "string") continue;
        const trimmed = v.trim();
        if (!trimmed) continue;
        // An AI follow-up reply is part of the same answer: append it inline.
        const fu = followUps[questions[i].id];
        const combined = fu
          ? `${trimmed} [follow-up "${fu.question}": ${fu.answer.trim()}]`
          : trimmed;
        const snippet = combined.slice(0, 800);
        byQuestion[i].answers.push(snippet);
        collected++;
        chars += snippet.length;
        if (collected >= MAX_ANSWERS || chars >= MAX_PROMPT_CHARS) break outer;
      }
    }
    if (collected === 0) throw new Error("No text answers yet, so there’s nothing to summarise.");

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
    const message = await client.beta.messages.create({
      model: "claude-sonnet-5-5",
      // Thinking tokens count toward max_tokens, so leave room beyond the JSON.
      max_tokens: 16000,
      // Reading up to 300 answers for themes benefits from a bit more thought.
      output_config: { effort: "medium" },
      // If a safety classifier declines, retry on a fallback model in the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    // Sonnet 5.5 thinks adaptively by default, so the reply can start with
    // (empty) thinking blocks; read by block type and check why it stopped.
    if (message.stop_reason === "refusal") {
      throw new Error("Claude declined this request. Try rewording it.");
    }
    if (message.stop_reason === "max_tokens") {
      throw new Error("Claude’s reply was cut off. Try again.");
    }

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
      throw new Error("Claude replied in a format we couldn’t read. Try again.");
    }

    const validated = RawSummarySchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error("Claude replied in a format we couldn’t read. Try again.");
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

Some answers end with a bracketed AI follow-up question and the respondent's reply to it; treat that reply as part of the same respondent's answer.

If the answers are too few or too thin for a confident analysis, say so honestly in "summary" and return fewer themes.`;
