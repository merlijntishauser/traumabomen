import { test, expect, type Page } from "@playwright/test";

const TEST_EMAIL = `test-${Date.now()}@example.com`;
const TEST_PASSWORD = "TestPassword123!";
const TEST_PASSPHRASE = "my-secure-test-passphrase";

async function register(page: Page) {
  await page.goto("/register");

  // Fill registration form
  await page.getByLabel(/email/i).fill(TEST_EMAIL);
  await page.getByLabel(/^password$/i).fill(TEST_PASSWORD);
  await page.getByLabel(/confirm password/i).fill(TEST_PASSWORD);
  await page.getByLabel(/^encryption passphrase$/i).fill(TEST_PASSPHRASE);
  await page.getByLabel(/confirm passphrase/i).fill(TEST_PASSPHRASE);
  await page.getByLabel(/i understand/i).check();
  await page.getByRole("button", { name: /create account/i }).click();

  // Wait for passphrase derivation and redirect to trees
  await page.waitForURL("**/trees", { timeout: 30_000 });
}

async function loginAndUnlock(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(TEST_EMAIL);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /log in/i }).click();

  // Enter passphrase
  await page.getByLabel(/passphrase/i).fill(TEST_PASSPHRASE);
  await page.getByRole("button", { name: /unlock/i }).click();

  await page.waitForURL("**/trees", { timeout: 30_000 });
}

test("full tree workflow: register, create tree, persons, relationships, events, timeline, persistence", async ({
  page,
}) => {
  // --- Register ---
  await register(page);
  await expect(page).toHaveURL(/\/trees$/);

  // --- Create tree ---
  await page.getByRole("button", { name: /create tree/i }).click();
  await page.waitForURL("**/trees/*");

  // --- Add person A (Alice) ---
  await page.getByRole("button", { name: /add person/i }).click();

  // Wait for the detail panel to appear
  const panel = page.locator(".detail-panel");
  await expect(panel).toBeVisible();

  // Edit person A
  const nameInput = panel.locator("input[type='text']").first();
  await nameInput.fill("Alice");
  const birthYearInput = panel.locator("input[type='number']").first();
  await birthYearInput.fill("1960");
  await panel.getByText(/^person\.save$|^save$/i).first().click();

  // Close panel
  await page.keyboard.press("Escape");
  await expect(panel).not.toBeVisible();

  // --- Add person B (Bob) ---
  await page.getByRole("button", { name: /add person/i }).click();
  await expect(panel).toBeVisible();

  const nameInput2 = panel.locator("input[type='text']").first();
  await nameInput2.fill("Bob");
  const birthYearInput2 = panel.locator("input[type='number']").first();
  await birthYearInput2.fill("1958");
  await panel.getByText(/^person\.save$|^save$/i).first().click();

  // Close panel
  await page.keyboard.press("Escape");

  // --- Verify both nodes appear ---
  await expect(page.locator(".person-node").filter({ hasText: "Alice" })).toBeVisible();
  await expect(page.locator(".person-node").filter({ hasText: "Bob" })).toBeVisible();

  // --- Create relationship via drag-to-connect ---
  // Get the source handle (bottom) of Alice and target handle (top) of Bob
  const aliceNode = page.locator(".person-node").filter({ hasText: "Alice" });
  const bobNode = page.locator(".person-node").filter({ hasText: "Bob" });
  const sourceHandle = aliceNode.locator(".react-flow__handle-bottom");
  const targetHandle = bobNode.locator(".react-flow__handle-top");

  // Drag from Alice's bottom handle to Bob's top handle
  await sourceHandle.dragTo(targetHandle);

  // Relationship type popover should appear
  const popover = page.locator(".relationship-popover");
  await expect(popover).toBeVisible();

  // Select "Partner"
  await popover.getByText(/partner/i).click();
  await expect(popover).not.toBeVisible();

  // --- Verify relationship edge exists ---
  // React Flow renders edges as SVG paths
  await expect(page.locator(".react-flow__edge")).toBeVisible();

  // --- Add trauma event on Alice ---
  await aliceNode.click();
  await expect(panel).toBeVisible();

  // Expand events section
  await panel.getByText(/trauma\.events|trauma events/i).click();
  await panel.getByText(/new event/i).click();

  // Fill event form
  const eventTitle = panel.locator(".detail-panel__event-form input[type='text']").first();
  await eventTitle.fill("Family loss");

  // Save event
  await panel.locator(".detail-panel__event-form").getByText(/^common\.save$|^save$/i).click();

  // Verify event badge appears on Alice's node
  await page.keyboard.press("Escape");
  await expect(aliceNode.locator(".person-node__badge")).toBeVisible();

  // --- Navigate to timeline ---
  await page.getByText(/timeline/i).click();
  await page.waitForURL("**/timeline");

  // Verify timeline renders with persons
  await expect(page.locator("svg")).toBeVisible();
  // Both person names should appear as labels in the SVG
  await expect(page.locator("text").filter({ hasText: "Alice" })).toBeVisible();
  await expect(page.locator("text").filter({ hasText: "Bob" })).toBeVisible();

  // --- Logout ---
  await page.getByText(/log out/i).click();
  await expect(page).toHaveURL(/\/login/);

  // --- Login and verify persistence ---
  await loginAndUnlock(page);

  // Navigate to the tree (should be the first/only tree)
  await page.getByRole("link", { name: /untitled|naamloz/i }).click();
  await page.waitForURL("**/trees/*");

  // Verify Alice and Bob are still there
  await expect(page.locator(".person-node").filter({ hasText: "Alice" })).toBeVisible();
  await expect(page.locator(".person-node").filter({ hasText: "Bob" })).toBeVisible();

  // Verify edge still exists
  await expect(page.locator(".react-flow__edge")).toBeVisible();

  // Verify trauma event persists
  await page.locator(".person-node").filter({ hasText: "Alice" }).click();
  await expect(panel).toBeVisible();
  await panel.getByText(/trauma\.events|trauma events/i).click();
  await expect(panel.getByText("Family loss")).toBeVisible();
});
