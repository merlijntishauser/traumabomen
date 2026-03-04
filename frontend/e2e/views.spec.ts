import { test, expect } from "@playwright/test";
import { register, createTree, uniqueEmail } from "./helpers/auth";

test.describe("Views", () => {
  /** Register, create tree, add a person for timeline content. */
  async function setupTreeWithPerson(page: import("@playwright/test").Page) {
    const email = uniqueEmail();
    await register(page, email);
    await createTree(page);

    // Add a person so views have content
    await page.getByLabel("Add person").click();
    const panel = page.locator(".detail-panel");
    await expect(panel).toBeVisible();
    await panel.locator("input[type='text']").first().fill("Alice");
    await panel.locator("input[type='number']").first().fill("1980");
    await panel.getByRole("button", { name: /save/i }).first().click();
    await page.keyboard.press("Escape");
  }

  test("timeline view renders", async ({ page }) => {
    await setupTreeWithPerson(page);

    await page.locator(".tree-toolbar__tab").filter({ hasText: /timeline/i }).click();
    await page.waitForURL("**/timeline");

    // Timeline container is present (contains the main SVG, controls, etc.)
    await expect(page.locator(".timeline-container")).toBeVisible();
  });

  test("patterns view loads", async ({ page }) => {
    await setupTreeWithPerson(page);

    await page.locator(".tree-toolbar__tab").filter({ hasText: /pattern/i }).click();
    await page.waitForURL("**/patterns");

    // Should show empty state or pattern content
    await expect(page.locator("main, .pattern")).toBeVisible();
  });

  test("journal view loads", async ({ page }) => {
    await setupTreeWithPerson(page);

    await page.locator(".tree-toolbar__tab").filter({ hasText: /journal/i }).click();
    await page.waitForURL("**/journal");

    // Should show journal page
    await expect(page.locator("main, .journal")).toBeVisible();
  });

  test("insights view loads", async ({ page }) => {
    await setupTreeWithPerson(page);

    await page.locator(".tree-toolbar__tab").filter({ hasText: /insight/i }).click();
    await page.waitForURL("**/insights");

    // Should show insights page
    await expect(page.locator("main, .insights")).toBeVisible();
  });
});
