import { createFileRoute } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

// Keep-alive for the free-tier Supabase project, hit once a day by Vercel Cron
// (registered in vite.config.ts under nitro.vercel.config.crons). It's the
// second, independent pinger next to the GitHub Action, so neither scheduler
// failing on its own can let the project pause.
//
// Vercel sends `Authorization: Bearer $CRON_SECRET` when that env var is set.
// Without it the endpoint stays open, which is harmless: all it can do is bump
// one timestamp through an RPC the public key can already call.
export const Route = createFileRoute("/api/keepalive")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
          return Response.json({ ok: false }, { status: 401 });
        }

        const { error } = await supabase.rpc("record_keepalive_ping");
        if (error) {
          // A non-2xx shows up as a failed invocation in Vercel's cron logs.
          return Response.json({ ok: false, error: error.message }, { status: 502 });
        }
        return Response.json(
          { ok: true },
          // Never cache: a cached 200 would look healthy without touching the database.
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
