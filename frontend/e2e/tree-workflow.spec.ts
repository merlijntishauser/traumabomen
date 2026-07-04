import { test, expect } from "@playwright/test";
import {
  register,
  loginAndUnlock,
  logout,
  createTree,
  uniqueEmail,
} from "./helpers/auth";

test.describe("Tree workflow", () => {
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
    const aliceYear = panel.locator("input[inputmode='numeric']").first();
    await aliceYear.fill("1960");
    // Autosave commits on blur; wait for the node label round trip.
    await aliceYear.blur();
    await expect(
      page.locator(".react-flow__node").filter({ hasText: "Alice" }),
    ).toBeAttached({ timeout: 10_000 });
    await page.keyboard.press("Escape");
    await expect(panel).not.toBeVisible();

    // Add person Bob (second person). The panel opens for the new person;
    // the relationship prompt waits until the panel closes, since it only
    // shows when nothing is selected.
    await page.getByLabel("Add person").click();
    await expect(panel).toBeVisible();

    await panel.locator("input[type='text']").first().fill("Bob");
    const bobYear = panel.locator("input[inputmode='numeric']").first();
    await bobYear.fill("1958");
    await bobYear.blur();
    await expect(page.locator(".react-flow__node").filter({ hasText: "Bob" })).toBeAttached({
      timeout: 10_000,
    });

    // Closing the panel (Close button, not Escape: Escape dismisses the
    // prompt too) reveals the relationship prompt.
    await panel.getByRole("button", { name: /close/i }).first().click();
    const prompt = page.locator(".relationship-prompt");
    await expect(prompt).toBeVisible({ timeout: 5_000 });

    // Handle relationship prompt: connect Bob to Alice as Partner
    await prompt.getByRole("button", { name: /yes/i }).click();
    await prompt.locator(".relationship-prompt__item").filter({ hasText: "Alice" }).click();
    await prompt.locator(".relationship-prompt__item").filter({ hasText: /partner/i }).click();

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
