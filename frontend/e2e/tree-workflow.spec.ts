import { test, expect } from "@playwright/test";
import {
  register,
  loginAndUnlock,
  logout,
  createTree,
  uniqueEmail,
} from "./helpers/auth";

test.describe("Tree workflow @smoketest", () => {
  test("create tree, add persons, create relationship, verify persistence", async ({
    page,
  }) => {
    const email = uniqueEmail();
    await register(page, email);

    // Create tree via inline form
    await createTree(page, "My Family");

    // Add person Alice (first person, no relationship prompt)
    await page.getByLabel("Add person").click();
    const panel = page.locator(".detail-panel");
    await expect(panel).toBeVisible();

    await panel.locator("input[type='text']").first().fill("Alice");
    await panel.locator("input[type='number']").first().fill("1960");
    await panel.getByRole("button", { name: /save/i }).first().click();
    await page.keyboard.press("Escape");

    // Add person Bob (second person, relationship prompt will appear)
    await page.getByLabel("Add person").click();
    await expect(panel).toBeVisible();
    await panel.locator("input[type='text']").first().fill("Bob");
    await panel.locator("input[type='number']").first().fill("1958");
    await panel.getByRole("button", { name: /save/i }).first().click();

    // The relationship prompt should appear for Bob
    const prompt = page.locator(".relationship-prompt");
    await expect(prompt).toBeVisible({ timeout: 5_000 });

    // Click "Yes" to connect Bob to someone
    await prompt.getByRole("button", { name: /yes/i }).click();

    // Pick Alice from the person list
    await prompt.locator(".relationship-prompt__item").filter({ hasText: "Alice" }).click();

    // Pick relationship type "Partner"
    await prompt.locator(".relationship-prompt__item").filter({ hasText: /partner/i }).click();

    // Close the panel
    await page.keyboard.press("Escape");

    // Verify both nodes exist on the canvas
    const aliceNode = page.locator(".react-flow__node").filter({ hasText: "Alice" });
    const bobNode = page.locator(".react-flow__node").filter({ hasText: "Bob" });
    await expect(aliceNode).toBeAttached();
    await expect(bobNode).toBeAttached();

    // Verify edge exists (relationship was created)
    await expect(page.locator(".react-flow__edge")).toBeAttached();

    // Logout and verify persistence
    await logout(page);
    await loginAndUnlock(page, email);

    // Navigate to tree via the tree list item link
    await page.locator(".tree-list-item__link").first().click();
    await page.waitForURL("**/trees/*");

    // Verify data persisted
    await expect(
      page.locator(".react-flow__node").filter({ hasText: "Alice" }),
    ).toBeAttached();
    await expect(
      page.locator(".react-flow__node").filter({ hasText: "Bob" }),
    ).toBeAttached();
    await expect(page.locator(".react-flow__edge")).toBeAttached();
  });
});
