import { test, expect } from "@playwright/test";
import { register, createTree, uniqueEmail } from "./helpers/auth";

/** Register, create a tree, add a person, then re-open the person panel. */
async function setupTreeWithPerson(
  page: import("@playwright/test").Page,
  name = "Alice",
) {
  const email = uniqueEmail();
  await register(page, email);
  await createTree(page);

  // Add a person (panel opens with new person)
  await page.getByLabel("Add person").click();
  const panel = page.locator(".detail-panel");
  await expect(panel).toBeVisible();

  const nameInput = panel.getByLabel(/^name$/i);
  const birthYearInput = panel.getByLabel(/birth year/i);

  // Fill form with retry: a React Query refetch can trigger a useEffect
  // that resets controlled inputs between fills.
  await expect(async () => {
    await nameInput.fill(name);
    await birthYearInput.fill("1980");
    await expect(nameInput).toHaveValue(name);
    await expect(birthYearInput).toHaveValue("1980");
  }).toPass({ timeout: 10_000 });

  await panel.getByRole("button", { name: /save/i }).first().click();

  // Wait for save to complete (panel closes on success), then reopen
  await expect(panel).not.toBeVisible({ timeout: 10_000 });
  await page.locator(".react-flow__node").filter({ hasText: name }).click();
  await expect(panel).toBeVisible();

  return panel;
}

test.describe("Data entry", () => {
  test("add trauma event to person", async ({ page }) => {
    const panel = await setupTreeWithPerson(page);

    // Navigate to Events tab
    await panel.getByRole("tab", { name: /events/i }).click();
    // Click the first segment (trauma events - default)
    await panel.locator(".detail-panel__segment").first().click();

    // Add new trauma event
    await panel.getByRole("button", { name: /new|add/i }).click();

    // Fill event form
    const form = panel.locator(".detail-panel__event-form");
    await form.locator("input[type='text']").first().fill("Childhood trauma");
    await form.locator("select").first().selectOption({ index: 1 });
    await form.getByRole("button", { name: /save/i }).click();

    // Verify event card appears
    await expect(panel.getByText("Childhood trauma")).toBeVisible();
  });

  test("add life event to person", async ({ page }) => {
    const panel = await setupTreeWithPerson(page);

    // Navigate to Events tab
    await panel.getByRole("tab", { name: /events/i }).click();
    // Click the second segment (life events)
    await panel.locator(".detail-panel__segment").nth(1).click();

    // Add new life event
    await panel.getByRole("button", { name: /new|add/i }).click();

    const form = panel.locator(".detail-panel__event-form");
    await form.locator("input[type='text']").first().fill("Started university");
    await form.locator("select").first().selectOption({ index: 1 });
    await form.getByRole("button", { name: /save/i }).click();

    await expect(panel.getByText("Started university")).toBeVisible();
  });

  test("add turning point to person", async ({ page }) => {
    const panel = await setupTreeWithPerson(page);

    // Navigate to Events tab
    await panel.getByRole("tab", { name: /events/i }).click();
    // Click the third segment (turning points)
    await panel.locator(".detail-panel__segment").nth(2).click();

    // Add new turning point
    await panel.getByRole("button", { name: /new|add/i }).click();

    const form = panel.locator(".detail-panel__event-form");
    await form.locator("input[type='text']").first().fill("Left toxic environment");
    await form.locator("select").first().selectOption({ index: 1 });
    await form.getByRole("button", { name: /save/i }).click();

    await expect(panel.getByText("Left toxic environment")).toBeVisible();
  });

  test("add classification to person", async ({ page }) => {
    const panel = await setupTreeWithPerson(page);

    // Navigate to Classifications tab (labeled "DSM-5")
    await panel.getByRole("tab", { name: /dsm|classification/i }).click();

    // Add new classification
    await panel.getByRole("button", { name: /new|add/i }).click();

    const form = panel.locator(".detail-panel__event-form");
    // Select a DSM category from the dropdown
    await form.locator("select").first().selectOption({ index: 1 });
    await form.getByRole("button", { name: /save/i }).click();

    // Verify classification card appears
    await expect(panel.locator(".detail-panel__event-card")).toBeVisible();
  });
});
