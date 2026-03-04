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
    await expect(panel).not.toBeVisible();

    // Add person Bob (second person, relationship prompt appears after save)
    await page.getByLabel("Add person").click();

    // Either the panel or relationship prompt may appear first depending on timing
    const prompt = page.locator(".relationship-prompt");
    const panelVisible = panel.waitFor({ state: "visible", timeout: 10_000 });
    const promptVisible = prompt.waitFor({ state: "visible", timeout: 10_000 });
    const first = await Promise.race([
      panelVisible.then(() => "panel" as const),
      promptVisible.then(() => "prompt" as const),
    ]);

    if (first === "panel") {
      // Panel opened: fill in details, save, then handle relationship prompt
      await panel.locator("input[type='text']").first().fill("Bob");
      await panel.locator("input[type='number']").first().fill("1958");
      await panel.getByRole("button", { name: /save/i }).first().click();
      await expect(prompt).toBeVisible({ timeout: 5_000 });
    }

    // Handle relationship prompt: connect Bob to Alice as Partner
    await prompt.getByRole("button", { name: /yes/i }).click();
    await prompt.locator(".relationship-prompt__item").filter({ hasText: "Alice" }).click();
    await prompt.locator(".relationship-prompt__item").filter({ hasText: /partner/i }).click();

    if (first === "prompt") {
      // Prompt appeared first: now click the node to edit details
      const newPersonNode = page.locator(".react-flow__node").filter({ hasText: "New person" });
      await newPersonNode.click();
      await expect(panel).toBeVisible();
      await panel.locator("input[type='text']").first().fill("Bob");
      await panel.locator("input[type='number']").first().fill("1958");
      await panel.getByRole("button", { name: /save/i }).first().click();
    }

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
