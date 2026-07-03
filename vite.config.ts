// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { readFileSync } from "fs";
import { join } from "path";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Vite loads .env *after* evaluating this config file, so process.env.* values
// from .env are not yet available here. Parse .env explicitly so the define
// below works correctly in dev. In production, set secrets via:
//   npx wrangler secret put ANTHROPIC_API_KEY
function loadDotEnv(): Record<string, string> {
  try {
    const content = readFileSync(join(process.cwd(), ".env"), "utf-8");
    const result: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const m = line.trim().match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) result[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    return result;
  } catch {
    return {};
  }
}

const dotEnv = loadDotEnv();
const ANTHROPIC_API_KEY = dotEnv.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? "";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  // Inject the API key so it is available as process.env.ANTHROPIC_API_KEY inside
  // createServerFn handlers running in the Cloudflare Workers sandbox.
  vite: {
    define: {
      "process.env.ANTHROPIC_API_KEY": JSON.stringify(ANTHROPIC_API_KEY),
    },
  },
});
