import { test, expect } from "@playwright/test";
import {
  register,
  login,
  logout,
  uniqueEmail,
  TEST_PASSWORD,
  TEST_PASSPHRASE,
} from "./helpers/auth";

test.describe("Settings", () => {
  /**
   * Open settings modal and navigate to the Security tab.
   */
  async function openSecuritySettings(page: import("@playwright/test").Page) {
    await page.getByRole("button", { name: "Settings" }).click();
    const modal = page.getByRole("dialog", { name: "Settings" });
    await expect(modal).toBeVisible();
    await modal.getByRole("button", { name: "Security" }).click();
    await expect(page.getByRole("heading", { name: /change password/i })).toBeVisible();
  }

  /**
   * Open settings modal and navigate to the Delete account tab.
   */
  async function openDeleteSettings(page: import("@playwright/test").Page) {
    await page.getByRole("button", { name: "Settings" }).click();
    const modal = page.getByRole("dialog", { name: "Settings" });
    await expect(modal).toBeVisible();
    await modal.getByRole("button", { name: "Delete account" }).click();
  }

  test("change password and login with new password", async ({ page }) => {
    const email = uniqueEmail();
    await register(page, email);

    await openSecuritySettings(page);

    const newPassword = "NewPassword456!";
    await page.getByPlaceholder("Current password").fill(TEST_PASSWORD);
    await page.getByPlaceholder("New password", { exact: true }).fill(newPassword);
    await page.getByPlaceholder("Confirm new password").fill(newPassword);

    // Click Save in the password section
    const pwSection = page.locator(".settings-panel__section").filter({
      has: page.getByRole("heading", { name: /change password/i }),
    });
    await pwSection.getByRole("button", { name: /save/i }).click();

    // Verify success message
    await expect(page.getByText(/password changed/i)).toBeVisible({
      timeout: 10_000,
    });

    // Logout and login with new password
    await logout(page);
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(newPassword);
    await page.getByRole("button", { name: /log in/i }).click();

    // Should reach /trees with AuthModal in unlock mode
    const modal = page.locator("[role='dialog']");
    await modal.waitFor({ state: "visible", timeout: 10_000 });
    await expect(modal.getByLabel(/passphrase/i)).toBeVisible();
  });

  test("change passphrase and unlock with new passphrase", async ({
    page,
  }) => {
    const email = uniqueEmail();
    await register(page, email);

    await openSecuritySettings(page);

    const newPassphrase = "my-new-secure-passphrase";
    await page.getByPlaceholder("Current passphrase").fill(TEST_PASSPHRASE);
    await page.getByPlaceholder("New passphrase", { exact: true }).fill(newPassphrase);
    await page.getByPlaceholder("Confirm new passphrase").fill(newPassphrase);

    // Click Save in the passphrase section
    const ppSection = page.locator(".settings-panel__section").filter({
      has: page.getByRole("heading", { name: /change passphrase/i }),
    });
    await ppSection.getByRole("button", { name: /save/i }).click();

    // Wait for re-encryption to complete
    await expect(page.getByText(/passphrase changed|re-encrypted/i)).toBeVisible({
      timeout: 30_000,
    });

    // Logout and login, unlock with new passphrase via AuthModal
    await logout(page);
    await login(page, email);

    const modal = page.locator("[role='dialog']");
    await modal.waitFor({ state: "visible", timeout: 10_000 });
    await modal.getByLabel(/passphrase/i).fill(newPassphrase);
    await modal.getByRole("button", { name: /unlock/i }).click();
    await modal.waitFor({ state: "hidden", timeout: 30_000 });
  });

  test("delete account", async ({ page }) => {
    const email = uniqueEmail();
    await register(page, email);

    await openDeleteSettings(page);

    // Click the initial "Delete account" button to expand confirmation form
    await page.getByRole("button", { name: "Delete account" }).click();

    // Fill confirmation fields
    await page.getByPlaceholder("Type DELETE to confirm").fill("DELETE");
    await page.getByPlaceholder("Enter your password").fill(TEST_PASSWORD);

    // Click the permanent delete button
    await page.getByRole("button", { name: /permanently delete/i }).click();

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

    // Verify account is deleted (login should fail)
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /log in/i }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  });
});
