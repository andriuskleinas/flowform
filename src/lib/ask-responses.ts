import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import type { Database } from "@/integrations/supabase/types";
import type { QuestionOptions } from "@/lib/form-utils";
import { parseFormSettings } from "@/lib/form-settings";
import {
  MAX_RESPONSES,
  runAsk,
  type AskQuestion,
  type AskResult,
  type AskRow,
} from "@/lib/ask-responses-core";

export type { AskCondition, AskResult } from "@/lib/ask-responses-core";

/**
 * "Ask your responses" server function: loads the form, its questions (plus
 * questions earlier versions asked) and responses through the caller's
 * RLS-scoped client, then hands them to runAsk in ask-responses-core.ts.
 */

const inputSchema = z.object({
  formId: z.string().uuid(),
  version: z.number().int().positive().optional(),
  question: z.string().trim().min(3).max(300),
});

function createUserScopedClient() {
  const url = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are not configured.");
  const authHeader = getRequest()?.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Log in to ask about responses.");
  }
  return createClient<Database>(url, key, {
    global: { headers: { Authorization: authHeader } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

// ── Server function ───────────────────────────────────────────────────────────

export const askResponses = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth])
  .inputValidator(inputSchema)
  .handler(async ({ data }): Promise<AskResult> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured on the server.");
    const supabase = createUserScopedClient();

    const { data: form, error: formErr } = await supabase
      .from("forms")
      .select("id, title, version, settings")
      .eq("id", data.formId)
      .maybeSingle();
    if (formErr) throw formErr;
    if (!form) throw new Error("Form not found.");
    const settings = parseFormSettings(form.settings);

    // Current questions, plus ones earlier versions asked (from snapshots).
    const [{ data: live, error: qErr }, { data: snaps, error: vErr }] = await Promise.all([
      supabase
        .from("questions")
        .select("id, label, type, options, position")
        .eq("form_id", data.formId)
        .order("position", { ascending: true }),
      supabase
        .from("form_versions")
        .select("version, questions")
        .eq("form_id", data.formId)
        .order("version", { ascending: false }),
    ]);
    if (qErr) throw qErr;
    if (vErr) throw vErr;
    const questions: AskQuestion[] = (live ?? []).map((q) => ({
      id: q.id,
      label: q.label,
      type: q.type,
      options: q.options as QuestionOptions,
    }));
    const seen = new Set(questions.map((q) => q.id));
    for (const s of snaps ?? []) {
      for (const q of (Array.isArray(s.questions) ? s.questions : []) as unknown as AskQuestion[]) {
        if (q?.id && !seen.has(q.id)) {
          seen.add(q.id);
          questions.push(q);
        }
      }
    }

    let rq = supabase
      .from("responses")
      .select("id, submitted_at, answers, follow_ups, meta, score, outcome")
      .eq("form_id", data.formId);
    if (data.version != null) rq = rq.eq("form_version", data.version);
    const { data: rawRows, error: rErr } = await rq
      .order("submitted_at", { ascending: false })
      .limit(MAX_RESPONSES + 1);
    if (rErr) throw rErr;
    const capped = (rawRows?.length ?? 0) > MAX_RESPONSES;
    const rows = ((rawRows ?? []).slice(0, MAX_RESPONSES) as unknown as AskRow[]).map((r) => ({
      ...r,
      answers: (r.answers ?? {}) as Record<string, unknown>,
    }));
    if (rows.length === 0) throw new Error("No responses yet, so there’s nothing to ask about.");

    return runAsk({
      client: new Anthropic({ apiKey }),
      formTitle: form.title,
      settings,
      questions,
      rows,
      question: data.question,
      capped,
    });
  });
