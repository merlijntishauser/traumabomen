import { expect, type Page, test } from "@playwright/test";
import { createTree, dismissOnboarding, login, logout } from "./helpers/auth";

/**
 * Production smoketest, run against the live deployment after each deploy:
 *
 *   E2E_SMOKETEST=true E2E_BASE_URL=https://www.traumatrees.org npx playwright test
 *
 * Unlike the regular e2e suite this never registers users and never resets the
 * database (playwright.config.ts skips the global setup in smoketest mode).
 * It logs in with the pre-provisioned smoketest account, exercises a full
 * encrypted round-trip on a throwaway tree, and cleans up after itself.
 * The config only selects this spec in smoketest mode and ignores it otherwise.
 */

const EMAIL = process.env.SMOKETEST_EMAIL ?? "";
const CREDENTIALS = {
  password: process.env.SMOKETEST_PASSWORD ?? "",
  passphrase: process.env.SMOKETEST_PASSPHRASE ?? "",
};

// Trees created by this spec carry this prefix so leftovers from a previously
// failed run can be recognized and removed.
const TREE_PREFIX = "Smoketest";

/**
 * Navigate to the tree list without a full page load: the encryption key
 * lives in memory only, so page.goto() would drop it and lock the app.
 */
async function gotoTreeList(page: Page): Promise<void> {
  if (!page.url().endsWith("/trees")) {
    await page.getByRole("link", { name: "My Trees" }).click();
  }
  await page.waitForURL("**/trees");
}

// Assertions against freshly-deployed production tolerate cold-start latency:
// the tree-list refetch after a delete (which also computes structural counts)
// can take several seconds on a cold Cloud Run instance.
const COLD = 30_000;

/**
 * Unlock resiliently against a freshly-deployed, possibly cold backend. The
 * unlock button only arms once GET /auth/salt resolves and populates the salt;
 * on a cold Cloud Run instance (or a token refresh on the round-trip re-login)
 * that request can stall past the test's patience, leaving the button disabled.
 * Rather than hang for the full test timeout, wait a bounded time for the button
 * to enable and otherwise reload, which re-fires the salt fetch: reloading while
 * locked keeps the session (tokens live in storage) but re-mounts the unlock
 * screen. If it is a real hang this still fails, just faster and with a clearer
 * signal than a single 180s timeout.
 */
async function unlockResilient(page: Page, passphrase: string, attempts = 3): Promise<void> {
  const modal = page.locator(".auth-modal");
  const submit = modal.getByRole("button", { name: /unlock/i });
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await modal.waitFor({ state: "visible", timeout: 15_000 });
    await modal.getByLabel(/^encryption key$/i).fill(passphrase);
    try {
      // Enabling waits for the salt fetch; keep it bounded so a stall triggers
      // a reload-retry instead of consuming the whole test budget.
      await expect(submit).toBeEnabled({ timeout: 20_000 });
      await submit.click();
      await modal.waitFor({ state: "hidden", timeout: COLD });
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
      await page.reload();
    }
  }
}

/** Log in, then unlock with the cold-start-tolerant unlock above. */
async function loginAndUnlockResilient(
  page: Page,
  email: string,
  credentials: { password: string; passphrase: string },
): Promise<void> {
  await login(page, email, credentials.password);
  await unlockResilient(page, credentials.passphrase);
}

/** Delete every tree whose name contains `text`, via the tree list UI. */
async function deleteTreesNamed(page: Page, text: string): Promise<void> {
  await gotoTreeList(page);
  // Wait for either the populated list or the empty state before counting.
  await expect(page.locator(".tree-list, .tree-list-empty").first()).toBeVisible();
  const items = page.locator(".tree-list li").filter({ hasText: text });
  // Guard-bounded loop so a stuck delete fails fast instead of hanging.
  for (let guard = 0; guard < 60; guard++) {
    const before = await items.count();
    if (before === 0) break;
    await items.first().getByRole("button", { name: /delete/i }).click();
    // The row swaps to an inline confirmation that replaces the tree name, so
    // it no longer matches the name filter; only one confirm is open at a time.
    const confirm = page.locator(".tree-list-item__confirm");
    await confirm.getByRole("button", { name: /delete/i }).click();
    // Wait for the true signal (the matching item is gone), not just the
    // confirm dismissing, and allow for a slow post-delete refetch.
    await expect(items).toHaveCount(before - 1, { timeout: COLD });
  }
}

test.describe("Production smoke", () => {
  test("login, encrypted tree round-trip, cleanup", async ({ page }) => {
    expect(
      EMAIL && CREDENTIALS.password && CREDENTIALS.passphrase,
      "SMOKETEST_EMAIL, SMOKETEST_PASSWORD, and SMOKETEST_PASSPHRASE must be set",
    ).toBeTruthy();

    await loginAndUnlockResilient(page, EMAIL, CREDENTIALS);
    await dismissOnboarding(page);

    // Remove leftovers from previously failed runs.
    await deleteTreesNamed(page, TREE_PREFIX);

    const treeName = `${TREE_PREFIX} ${Date.now()}`;
    await createTree(page, treeName);

    // Add one person; fields encrypt client-side and autosave on blur.
    await page.getByLabel("Add person").click();
    const panel = page.locator(".detail-panel");
    await expect(panel).toBeVisible();
    await panel.locator("input[type='text']").first().fill("Alice");
    const yearInput = panel.locator("input[inputmode='numeric']").first();
    await yearInput.fill("1960");
    await yearInput.blur();
    await expect(page.locator(".react-flow__node").filter({ hasText: "Alice" })).toBeAttached({
      timeout: COLD,
    });
    await page.keyboard.press("Escape");
    await expect(panel).not.toBeVisible();

    // Full crypto round-trip: a fresh session must decrypt the stored data.
    await logout(page);
    await loginAndUnlockResilient(page, EMAIL, CREDENTIALS);
    await page.locator(".tree-list-item__link").filter({ hasText: treeName }).click();
    await page.waitForURL("**/trees/*");
    await expect(page.locator(".react-flow__node").filter({ hasText: "Alice" })).toBeAttached({
      timeout: COLD,
    });

    await deleteTreesNamed(page, TREE_PREFIX);
  });
});
