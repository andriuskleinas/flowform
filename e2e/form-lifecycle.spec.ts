import { expect, test } from "@playwright/test";
import { E2E_EMAIL, E2E_PASSWORD } from "./global-setup";

/**
 * The core loop: create → publish → respond → analyse.
 * The owner builds and publishes a form; an anonymous visitor (separate
 * browser context, no session) answers it; the owner sees the response.
 */
test("create, publish, respond and analyse a form", async ({ page, browser }) => {
  const title = `E2E survey ${Date.now()}`;

  // --- Log in -------------------------------------------------------------
  await page.goto("/login");
  // Wait for hydration so typed values land in React state.
  await page.waitForLoadState("networkidle");
  await page.getByPlaceholder("you@example.com").fill(E2E_EMAIL);
  await page.getByPlaceholder("Your password").fill(E2E_PASSWORD);
  await expect(page.getByPlaceholder("you@example.com")).toHaveValue(E2E_EMAIL);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // --- Create -------------------------------------------------------------
  await page.goto("/forms/new");
  await page.getByText("Blank form").click();
  await expect(page).toHaveURL(/\/forms\/[0-9a-f-]{36}\/edit/);
  const formId = page.url().match(/forms\/([0-9a-f-]{36})/)![1];

  await page.getByPlaceholder("Name your form").fill(title);
  await page.getByRole("button", { name: "Classic", exact: true }).click();
  await page.getByRole("button", { name: "Add question" }).click();
  await page.getByRole("menuitem", { name: "Short answer" }).click();
  await page.getByPlaceholder("Type your question…").last().fill("What is your name?");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  // --- Publish ------------------------------------------------------------
  await page.getByRole("button", { name: "Publish form" }).click();
  await expect(page.getByRole("button", { name: "Close form" })).toBeVisible();

  // --- Respond (anonymous visitor) ----------------------------------------
  const visitor = await browser.newContext();
  const respondent = await visitor.newPage();
  await respondent.goto(`/forms/${formId}`);
  await expect(respondent.getByRole("heading", { name: title })).toBeVisible();
  await respondent.getByPlaceholder("Your answer").fill("Ada Lovelace");
  await respondent.getByRole("button", { name: "Submit" }).click();
  await expect(respondent.getByText("Your response was recorded.")).toBeVisible();
  await visitor.close();

  // --- Analyse ------------------------------------------------------------
  await page.goto(`/forms/${formId}/responses`);
  await expect(page.getByText(/^1 response/)).toBeVisible();
  await page.getByRole("tab", { name: "Individual responses" }).click();
  await expect(page.getByText("Ada Lovelace")).toBeVisible();
  await page.getByRole("button", { name: "Table" }).click();
  await expect(page.getByRole("cell", { name: "Ada Lovelace" })).toBeVisible();
});
