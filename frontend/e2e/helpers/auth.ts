import type { Page } from "@playwright/test";

export const TEST_PASSWORD = "TestPassword123!";
export const TEST_PASSPHRASE = "my-secure-test-passphrase";

let emailCounter = 0;

export function uniqueEmail(): string {
  emailCounter++;
  const rand = Math.random().toString(36).slice(2, 8);
  return `e2e-${Date.now()}-${emailCounter}-${rand}@example.com`;
}

/** Dismiss the onboarding safety gate if it appears. */
export async function dismissOnboarding(page: Page): Promise<void> {
  const continueButton = page.locator(".onboarding-gate__continue");
  if (await continueButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await continueButton.click();
  }
}

export async function register(
  page: Page,
  email: string,
  options?: { hint?: string },
): Promise<void> {
  await page.goto("/register");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password$/i).fill(TEST_PASSWORD);
  await page.getByLabel(/confirm password/i).fill(TEST_PASSWORD);
  await page.getByLabel(/^encryption passphrase$/i).fill(TEST_PASSPHRASE);
  await page.getByLabel(/confirm passphrase/i).fill(TEST_PASSPHRASE);
  if (options?.hint) {
    await page.getByLabel(/hint/i).fill(options.hint);
  }
  await page.getByLabel(/i understand/i).check();

  // Registration may fail under parallel load; retry once
  const submitBtn = page.getByRole("button", { name: /create account/i });
  for (let attempt = 0; attempt < 2; attempt++) {
    await submitBtn.click();
    const result = await Promise.race([
      page.waitForURL("**/trees", { timeout: 20_000 }).then(() => "ok" as const),
      page.getByText(/registration failed/i).waitFor({ state: "visible", timeout: 20_000 }).then(() => "retry" as const),
      page.getByText(/already exists/i).waitFor({ state: "visible", timeout: 20_000 }).then(() => "exists" as const),
    ]);
    if (result === "ok") break;
    if (result === "exists") {
      // Account was created (e.g. by a parallel worker); login instead
      await login(page, email);
      await unlock(page);
      return;
    }
  }

  await dismissOnboarding(page);
}

export async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /log in/i }).click();
  // Login now redirects to /trees with AuthModal overlay
  await page.waitForURL("**/trees", { timeout: 10_000 });
}

export async function unlock(page: Page): Promise<void> {
  // Wait for AuthModal dialog to appear
  const modal = page.locator("[role='dialog']");
  await modal.waitFor({ state: "visible", timeout: 10_000 });
  await modal.getByLabel(/passphrase/i).fill(TEST_PASSPHRASE);
  await modal.getByRole("button", { name: /unlock/i }).click();
  // Wait for modal to dismiss after successful unlock
  await modal.waitFor({ state: "hidden", timeout: 30_000 });
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
  // Logout clears wasAuthenticated, AuthGuard redirects to /login
  await page.waitForURL("**/login", { timeout: 15_000 });
}
