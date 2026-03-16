import { test, expect } from "@playwright/test";
import { uniqueEmail, register, TEST_PASSWORD } from "./helpers/auth";
import { fetchPasswordResetEmail, clearMailpit } from "./helpers/mailpit";

// This test requires REQUIRE_EMAIL_VERIFICATION=true and a running Mailpit.
// Run explicitly with: E2E_VERIFICATION=true make e2e
const VERIFICATION_ENABLED = process.env.E2E_VERIFICATION === "true";

test.describe("Password reset @verification", () => {
  test.skip(!VERIFICATION_ENABLED, "Skipped: set E2E_VERIFICATION=true to run");

  test("request reset, receive email, set new password, login", async ({
    page,
  }) => {
    await clearMailpit();
    const email = uniqueEmail();
    const newPassword = "NewSecurePassword456!";

    // Register an account first
    await register(page, email);

    // Log out
    await page.getByRole("button", { name: /log out/i }).click();
    await page.waitForURL("**/login", { timeout: 15_000 });

    // Click "Forgot your password?"
    await page.getByRole("link", { name: /forgot/i }).click();
    await page.waitForURL("**/forgot-password", { timeout: 5_000 });

    // Submit the forgot password form
    const emailInput = page.getByLabel(/^email$/i);
    await expect(emailInput).toBeVisible({ timeout: 5_000 });
    await emailInput.fill(email);
    await page.getByRole("button", { name: /send reset link/i }).click();

    // Should show success message (anti-enumeration: always shows success)
    await expect(
      page.getByText(/sent a reset link|check your email|reset link/i),
    ).toBeVisible({ timeout: 15_000 });

    // Fetch the reset link from Mailpit
    const resetUrl = await fetchPasswordResetEmail(email);
    expect(resetUrl).toContain("reset-password");

    // Navigate to the reset URL
    await page.goto(resetUrl);

    // Fill in new password
    await page.getByLabel(/^new password$/i).fill(newPassword);
    await page.getByLabel(/confirm new password/i).fill(newPassword);
    await page.getByRole("button", { name: /set new password/i }).click();

    // Should show success
    await expect(
      page.getByText(/password has been reset|log in with your new password/i),
    ).toBeVisible({ timeout: 10_000 });

    // Click login link
    await page.getByRole("link", { name: /log in/i }).click();
    await page.waitForURL("**/login", { timeout: 5_000 });

    // Log in with new password
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/^password$/i).fill(newPassword);
    await page.getByRole("button", { name: /log in/i }).click();

    // Should reach /trees (with auth modal overlay)
    await page.waitForURL("**/trees", { timeout: 10_000 });
  });
});
