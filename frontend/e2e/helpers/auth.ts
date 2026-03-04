import type { Page } from "@playwright/test";

export const TEST_PASSWORD = "TestPassword123!";
export const TEST_PASSPHRASE = "my-secure-test-passphrase";

let emailCounter = 0;

export function uniqueEmail(): string {
  emailCounter++;
  return `e2e-${Date.now()}-${emailCounter}@example.com`;
}

/** Dismiss the onboarding safety gate if it appears. */
export async function dismissOnboarding(page: Page): Promise<void> {
  const continueButton = page.locator(".onboarding-gate__continue");
  if (await continueButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await continueButton.click();
  }
}

export async function register(page: Page, email: string): Promise<void> {
  await page.goto("/register");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password$/i).fill(TEST_PASSWORD);
  await page.getByLabel(/confirm password/i).fill(TEST_PASSWORD);
  await page.getByLabel(/^encryption passphrase$/i).fill(TEST_PASSPHRASE);
  await page.getByLabel(/confirm passphrase/i).fill(TEST_PASSPHRASE);
  await page.getByLabel(/i understand/i).check();
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL("**/trees", { timeout: 30_000 });
  await dismissOnboarding(page);
}

export async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL("**/unlock", { timeout: 10_000 });
}

export async function unlock(page: Page): Promise<void> {
  await page.getByLabel(/passphrase/i).fill(TEST_PASSPHRASE);
  await page.getByRole("button", { name: /unlock/i }).click();
  await page.waitForURL("**/trees", { timeout: 30_000 });
}

export async function loginAndUnlock(
  page: Page,
  email: string,
): Promise<void> {
  await login(page, email);
  await unlock(page);
}

/** Click "Create tree", fill name, submit, wait for workspace URL. */
export async function createTree(
  page: Page,
  name = "Test Tree",
): Promise<void> {
  // Click the toolbar "Create tree" button (exact match avoids "Create your first tree")
  await page.getByRole("button", { name: "Create tree", exact: true }).click();
  // Fill the tree name in the inline form
  await page.getByRole("textbox", { name: /tree name/i }).fill(name);
  // Submit via the form's "Create tree" button
  await page.locator("form").getByRole("button", { name: /create tree/i }).click();
  await page.waitForURL("**/trees/*", { timeout: 30_000 });
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: /log out/i }).click();
  await page.waitForURL("**/unlock", { timeout: 10_000 });
  await page
    .getByRole("button", { name: /log in with a different account/i })
    .click();
  await page.waitForURL("**/login", { timeout: 10_000 });
}
