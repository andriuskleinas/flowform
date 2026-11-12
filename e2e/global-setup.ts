/**
 * Creates a confirmed test account on the local Supabase stack through the
 * admin API, so the test can log in without any email round-trip.
 */
export const E2E_EMAIL = "e2e-owner@flowform.test";
export const E2E_PASSWORD = "e2e-Password-123!";

export default async function globalSetup() {
  const url = process.env.E2E_SUPABASE_URL;
  const serviceKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || !process.env.E2E_SUPABASE_ANON_KEY) {
    throw new Error(
      "Set E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY and E2E_SUPABASE_SERVICE_ROLE_KEY (from `supabase status`).",
    );
  }
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) {
    throw new Error(`Refusing to run e2e tests against a non-local Supabase (${host}).`);
  }
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: E2E_EMAIL, password: E2E_PASSWORD, email_confirm: true }),
  });
  // 422 = already exists from an earlier local run; anything else is fatal.
  if (!res.ok && res.status !== 422) {
    throw new Error(`Could not create the e2e user: ${res.status} ${await res.text()}`);
  }
}
