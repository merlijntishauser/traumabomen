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

  // Let initial tree data queries settle before interacting
  await page.waitForLoadState("networkidle");

  // Add a person (panel opens with new person)
  await page.getByLabel("Add person").click();
  const panel = page.locator(".detail-panel");
  await expect(panel).toBeVisible();

  // Settle any in-flight tree-data refetch before filling: a React Query
  // refetch triggers a useEffect that re-syncs (and clears) the controlled
  // inputs, which would otherwise race the fill.
  await page.waitForLoadState("networkidle");

  const nameInput = panel.getByLabel(/^name$/i);
  const birthYearInput = panel.getByLabel(/birth year/i);

  // Fill with retry as a safety net in case a late refetch still resets the
  // inputs between fills. Re-fill until both values stick.
  await expect(async () => {
    await nameInput.fill(name);
    await birthYearInput.fill("1980");
    await expect(nameInput).toHaveValue(name);
    await expect(birthYearInput).toHaveValue("1980");
  }).toPass({ timeout: 30_000 });

  // Guard against a refetch clearing the inputs between the last check and
  // the commit: confirm the values immediately before blurring.
  await expect(nameInput).toHaveValue(name);
  // Autosave commits on blur; the panel stays open. The node label confirms
  // the save round trip landed.
  await birthYearInput.blur();
  await expect(page.locator(".react-flow__node").filter({ hasText: name })).toBeAttached({
    timeout: 10_000,
  });

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
    const form = panel.locator(".detail-panel__sub-body");
    await form.locator("input[type='text']").first().fill("Childhood trauma");
    await form.locator("select").first().selectOption({ index: 1 });
    await form.getByRole("button", { name: "Add", exact: true }).click();

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

    const form = panel.locator(".detail-panel__sub-body");
    await form.locator("input[type='text']").first().fill("Started university");
    await form.locator("select").first().selectOption({ index: 1 });
    await form.getByRole("button", { name: "Add", exact: true }).click();

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

    const form = panel.locator(".detail-panel__sub-body");
    await form.locator("input[type='text']").first().fill("Left toxic environment");
    await form.locator("select").first().selectOption({ index: 1 });
    await form.getByRole("button", { name: "Add", exact: true }).click();

    await expect(panel.getByText("Left toxic environment")).toBeVisible();
  });

  test("add classification to person", async ({ page }) => {
    const panel = await setupTreeWithPerson(page);

    // Navigate to Classifications tab (labeled "DSM-5")
    await panel.getByRole("tab", { name: /dsm|classification/i }).click();

    // Add new classification
    await panel.getByRole("button", { name: /new|add/i }).click();

    const form = panel.locator(".detail-panel__sub-body");
    // Select a DSM category from the dropdown
    await form.locator("select").first().selectOption({ index: 1 });
    await form.getByRole("button", { name: "Add", exact: true }).click();

    // Verify classification card appears
    await expect(panel.locator(".detail-panel__event-card")).toBeVisible();
  });
});
