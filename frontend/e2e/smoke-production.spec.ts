import { expect, type Page, test } from "@playwright/test";
import { createTree, dismissOnboarding, loginAndUnlock, logout } from "./helpers/auth";

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

/** Delete every tree whose name contains `text`, via the tree list UI. */
async function deleteTreesNamed(page: Page, text: string): Promise<void> {
  await gotoTreeList(page);
  // Wait for either the populated list or the empty state before counting.
  await expect(page.locator(".tree-list, .tree-list-empty").first()).toBeVisible();
  const items = page.locator(".tree-list li").filter({ hasText: text });
  while ((await items.count()) > 0) {
    await items.first().getByRole("button", { name: /delete/i }).click();
    // The row swaps to an inline confirmation that replaces the tree name, so
    // it no longer matches the name filter; only one confirm is open at a time.
    const confirm = page.locator(".tree-list-item__confirm");
    await confirm.getByRole("button", { name: /delete/i }).click();
    await expect(confirm).toHaveCount(0);
  }
}

test.describe("Production smoke", () => {
  test("login, encrypted tree round-trip, cleanup", async ({ page }) => {
    expect(
      EMAIL && CREDENTIALS.password && CREDENTIALS.passphrase,
      "SMOKETEST_EMAIL, SMOKETEST_PASSWORD, and SMOKETEST_PASSPHRASE must be set",
    ).toBeTruthy();

    await loginAndUnlock(page, EMAIL, CREDENTIALS);
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
      timeout: 15_000,
    });
    await page.keyboard.press("Escape");
    await expect(panel).not.toBeVisible();

    // Full crypto round-trip: a fresh session must decrypt the stored data.
    await logout(page);
    await loginAndUnlock(page, EMAIL, CREDENTIALS);
    await page.locator(".tree-list-item__link").filter({ hasText: treeName }).click();
    await page.waitForURL("**/trees/*");
    await expect(page.locator(".react-flow__node").filter({ hasText: "Alice" })).toBeAttached();

    await deleteTreesNamed(page, TREE_PREFIX);
  });
});
