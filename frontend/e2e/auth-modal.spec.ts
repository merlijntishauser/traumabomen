import { test, expect } from "@playwright/test";
import {
  register,
  login,
  logout,
  unlock,
  uniqueEmail,
  TEST_PASSPHRASE,
} from "./helpers/auth";

test.describe("AuthModal", () => {
  test("shows AuthModal in unlock mode after login", async ({ page }) => {
    const email = uniqueEmail();
    await register(page, email);
    await logout(page);
    await login(page, email);

    // AuthModal should appear as a dialog overlay
    const modal = page.locator("[role='dialog']");
    await expect(modal).toBeVisible({ timeout: 10_000 });
    // Should show passphrase input (unlock mode, no credentials step)
    await expect(modal.getByLabel(/passphrase/i)).toBeVisible();
  });

  test("unlocks via AuthModal and dismisses overlay", async ({ page }) => {
    const email = uniqueEmail();
    await register(page, email);
    await logout(page);
    await login(page, email);

    await unlock(page);

    // Modal should be gone, trees page visible
    await expect(page.locator("[role='dialog']")).not.toBeVisible();
    await expect(page).toHaveURL(/\/trees$/);
  });

  test("displays passphrase hint in AuthModal when set", async ({ page }) => {
    const hint = "First pet name backwards";
    const email = uniqueEmail();
    await register(page, email, { hint });
    await logout(page);
    await login(page, email);

    // Wait for AuthModal
    const modal = page.locator("[role='dialog']");
    await expect(modal).toBeVisible({ timeout: 10_000 });

    // Hint should be displayed
    await expect(modal.getByTestId("auth-modal-hint")).toBeVisible();
    await expect(modal.getByTestId("auth-modal-hint")).toContainText(hint);
  });

  test("does not show hint block when no hint is set", async ({ page }) => {
    const email = uniqueEmail();
    await register(page, email); // no hint
    await logout(page);
    await login(page, email);

    const modal = page.locator("[role='dialog']");
    await expect(modal).toBeVisible({ timeout: 10_000 });

    // Hint block should not be present
    await expect(modal.getByTestId("auth-modal-hint")).not.toBeVisible();
  });

  test("wrong passphrase shows error in AuthModal", async ({ page }) => {
    const email = uniqueEmail();
    await register(page, email);
    await logout(page);
    await login(page, email);

    const modal = page.locator("[role='dialog']");
    await modal.waitFor({ state: "visible", timeout: 10_000 });
    await modal.getByLabel(/passphrase/i).fill("totally-wrong-passphrase");
    await modal.getByRole("button", { name: /unlock/i }).click();

    await expect(modal.locator(".auth-error")).toBeVisible({ timeout: 15_000 });
    // Modal should still be visible (not dismissed)
    await expect(modal).toBeVisible();
  });

  test("switch account link logs out and redirects to login", async ({
    page,
  }) => {
    const email = uniqueEmail();
    await register(page, email);
    await logout(page);
    await login(page, email);

    const modal = page.locator("[role='dialog']");
    await modal.waitFor({ state: "visible", timeout: 10_000 });

    // Click "switch account" / logout link
    await modal.getByRole("button", { name: /different account|ander account/i }).click();

    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
