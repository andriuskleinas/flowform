import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a LOCAL Supabase stack (`supabase start`), never
 * production: global-setup refuses any non-local URL. CI wires the env vars
 * from `supabase status`; locally run `supabase start` first, then
 * `bun run test:e2e` with the same variables exported.
 */
const PORT = 4173;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `bunx vite dev --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: process.env.E2E_SUPABASE_URL ?? "",
      VITE_SUPABASE_PUBLISHABLE_KEY: process.env.E2E_SUPABASE_ANON_KEY ?? "",
      SUPABASE_URL: process.env.E2E_SUPABASE_URL ?? "",
    },
  },
});
