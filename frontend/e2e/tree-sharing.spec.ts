import { test, expect, type Browser, type Page } from "@playwright/test";
import {
  register,
  loginAndUnlock,
  logout,
  createTree,
  uniqueEmail,
  TEST_PASSPHRASE,
} from "./helpers/auth";

const API_URL = process.env.E2E_API_URL || "http://localhost:8000";

async function setSharingFlag(audience: "all" | "disabled"): Promise<void> {
  const response = await fetch(`${API_URL}/test/feature-flag`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: "tree_sharing", audience }),
  });
  if (!response.ok) throw new Error(`Setting the flag failed: ${response.status}`);
}

async function newPage(browser: Browser, baseURL: string | undefined): Promise<Page> {
  const context = await browser.newContext({ baseURL });
  return context.newPage();
}

/** A reload drops the in-memory key, so the unlock prompt appears again. */
async function unlockIfPrompted(page: Page): Promise<void> {
  const field = page.getByLabel(/^encryption key$/i);
  const prompted = await field
    .waitFor({ state: "visible", timeout: 8_000 })
    .then(() => true)
    .catch(() => false);
  if (prompted) {
    await field.fill(TEST_PASSPHRASE);
    await page.getByRole("button", { name: /^unlock$/i }).click();
    await field.waitFor({ state: "hidden", timeout: 30_000 });
  }
}

/** In-app navigation, so the key stays in memory (a full page load would lock). */
async function backToTrees(page: Page): Promise<void> {
  await page.getByRole("link", { name: "My trees" }).click();
  await page.waitForURL("**/trees");
}

/** Open the share dialog from the row menu of the only tree in the list. */
async function openShareDialog(page: Page, treeName: string) {
  await page.getByRole("button", { name: `Options for ${treeName}` }).click();
  await page.getByRole("menuitem", { name: "Share", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: `Share ${treeName}` });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("Tree sharing", () => {
  test.beforeAll(async () => {
    await setSharingFlag("all");
  });

  test.afterAll(async () => {
    await setSharingFlag("disabled");
  });

  test("owner shares with a registered user who sees it read-only", async ({ browser, baseURL }) => {
    const ownerPage = await newPage(browser, baseURL);
    const viewerPage = await newPage(browser, baseURL);
    const ownerEmail = uniqueEmail();
    const viewerEmail = uniqueEmail();

    // The viewer registers first so that a key pair exists to wrap the tree key for.
    await register(viewerPage, viewerEmail);
    await register(ownerPage, ownerEmail);
    await createTree(ownerPage, "Shared Family");
    await ownerPage.getByLabel("Add person").click();
    const panel = ownerPage.locator(".detail-panel");
    await panel.getByLabel("Name", { exact: true }).fill("Alice");
    await panel.getByLabel("Birth year", { exact: true }).fill("1960");
    await panel.getByLabel("Birth year", { exact: true }).blur();
    await expect(
      ownerPage.locator(".react-flow__node").filter({ hasText: "Alice" }),
    ).toBeAttached({ timeout: 10_000 });

    await backToTrees(ownerPage);
    const dialog = await openShareDialog(ownerPage, "Shared Family");
    await dialog.getByLabel(/email address/i).fill(viewerEmail);
    await dialog.getByRole("button", { name: "Share", exact: true }).click();
    await expect(dialog.getByText(viewerEmail)).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByText("Can view")).toBeVisible();
    await dialog.getByRole("button", { name: "Close" }).click();

    // The viewer's list picks the tree up after a fresh unlock.
    await viewerPage.reload();
    await unlockIfPrompted(viewerPage);
    const shared = viewerPage.getByRole("region", { name: "Shared with me" });
    await expect(shared).toBeVisible({ timeout: 15_000 });
    await shared.getByRole("link", { name: /Shared Family/ }).click();
    await viewerPage.waitForURL("**/trees/*");

    await expect(viewerPage.getByText(/View only/)).toBeVisible({ timeout: 15_000 });
    await expect(
      viewerPage.locator(".react-flow__node").filter({ hasText: "Alice" }),
    ).toBeAttached({ timeout: 15_000 });
    await expect(viewerPage.getByLabel("Add person")).toHaveCount(0);
    await expect(viewerPage.getByRole("link", { name: "Journal" })).toHaveCount(0);

    // Reloading locks the key; unlocking again must restore the read-only view.
    await viewerPage.reload();
    await unlockIfPrompted(viewerPage);
    await expect(viewerPage.getByText(/View only/)).toBeVisible({ timeout: 15_000 });

    // The owner revokes; the viewer's next fetch finds nothing.
    const revokeDialog = await openShareDialog(ownerPage, "Shared Family");
    await revokeDialog.getByRole("button", { name: "Remove access" }).click();
    await expect(revokeDialog.getByText("Remove their access?")).toBeVisible();
    await revokeDialog.getByRole("button", { name: "Remove access" }).click();
    await expect(revokeDialog.getByText("This tree is not shared with anyone.")).toBeVisible({
      timeout: 15_000,
    });

    // The viewer still has the workspace open: the next view they open refetches and finds nothing.
    await viewerPage.getByRole("link", { name: "Timeline" }).click();
    await expect(viewerPage.getByText("This tree is no longer shared with you.")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("pending invite completes after the recipient registers", async ({ browser, baseURL }) => {
    const ownerPage = await newPage(browser, baseURL);
    const inviteePage = await newPage(browser, baseURL);
    const ownerEmail = uniqueEmail();
    const inviteeEmail = uniqueEmail();

    await register(ownerPage, ownerEmail);
    await createTree(ownerPage, "Invited Family");
    await backToTrees(ownerPage);

    const dialog = await openShareDialog(ownerPage, "Invited Family");
    await dialog.getByLabel(/email address/i).fill(inviteeEmail);
    await dialog.getByRole("button", { name: "Share", exact: true }).click();
    await expect(dialog.getByText(/has no account yet/)).toBeVisible({ timeout: 15_000 });
    await dialog.getByRole("button", { name: "Send invitation" }).click();
    await expect(dialog.getByText("Invited, waiting for them to set up")).toBeVisible({
      timeout: 15_000,
    });
    await dialog.getByRole("button", { name: "Close" }).click();

    // The invitee sets up an account; nothing is shared with them yet, because
    // the owner's browser has to wrap the tree key first.
    await register(inviteePage, inviteeEmail);
    await expect(inviteePage.getByRole("region", { name: "Shared with me" })).toHaveCount(0);

    // The owner's next unlock completes the pending share.
    await logout(ownerPage);
    await loginAndUnlock(ownerPage, ownerEmail);
    await openShareDialog(ownerPage, "Invited Family").then((d) =>
      expect(d.getByText("Can view")).toBeVisible({ timeout: 20_000 }),
    );

    await logout(inviteePage);
    await loginAndUnlock(inviteePage, inviteeEmail);
    const shared = inviteePage.getByRole("region", { name: "Shared with me" });
    await expect(shared).toBeVisible({ timeout: 15_000 });
    await expect(shared.getByRole("link", { name: /Invited Family/ })).toBeVisible();
  });
});
