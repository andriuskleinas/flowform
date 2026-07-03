// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, componentTagger (dev-only),
//     VITE_* env injection, @ path alias, React/TanStack dedupe, error logger plugins,
//     and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

export default defineConfig({
  // Deploying to Vercel now, not Cloudflare Workers.
  cloudflare: false,
  // The wrapper's TS types don't expose a top-level `nitro` key, but it merges
  // `vite` straight into the final Vite config — and that's exactly where
  // nitro/vite's plugin reads its options from (userConfig.nitro).
  vite: {
    nitro: {
      // Recovers from h3 swallowing an in-handler throw into a generic JSON 500 —
      // see src/lib/nitro-error-handler.ts for details.
      errorHandler: "./src/lib/nitro-error-handler.ts",
      routeRules: {
        "/**": {
          headers: {
            "Content-Security-Policy":
              "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
            "X-Frame-Options": "DENY",
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
          },
        },
      },
    },
  },
  plugins: [nitro()],
});
