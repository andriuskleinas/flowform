import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import type { FormStatus } from "@/lib/form-utils";

export type PublicFormMeta = {
  title: string;
  description: string | null;
  status: FormStatus;
} | null;

const inputSchema = z.object({ formId: z.string().uuid() });

/**
 * Session-less anon client for server-side reads of public data. The RLS
 * policy already scopes anonymous SELECTs to published/closed forms, so no
 * service-role key is needed (and none is configured in all environments).
 */
function createAnonServerClient() {
  const url = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are not configured.");
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Fetches title/description for a form's public page so the route loader can
 * emit per-form OG/meta tags during SSR (link previews in Slack, WhatsApp,
 * LinkedIn, …). Drafts are excluded by RLS, so their metadata never leaks.
 */
export const getPublicFormMeta = createServerFn({ method: "GET" })
  .inputValidator(inputSchema)
  .handler(async ({ data }): Promise<PublicFormMeta> => {
    const supabase = createAnonServerClient();
    const { data: form, error } = await supabase
      .from("forms")
      .select("title, description, status")
      .eq("id", data.formId)
      .in("status", ["published", "closed"])
      .maybeSingle();
    if (error || !form) return null;
    return {
      title: form.title,
      description: form.description,
      status: form.status as FormStatus,
    };
  });
