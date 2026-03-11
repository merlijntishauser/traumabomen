import { test, expect } from "@playwright/test";
import { uniqueEmail, TEST_PASSWORD, TEST_PASSPHRASE } from "./helpers/auth";
import { fetchVerificationEmail, clearMailpit } from "./helpers/mailpit";

// This test requires REQUIRE_EMAIL_VERIFICATION=true on the API.
// Skip when running against a dev environment where verification is disabled.
// Run explicitly with: E2E_VERIFICATION=true make e2e
const VERIFICATION_ENABLED = process.env.E2E_VERIFICATION === "true";

test.describe("Email verification @verification", () => {
  test.skip(!VERIFICATION_ENABLED, "Skipped: set E2E_VERIFICATION=true to run");

  test("register and verify email via Mailpit", async ({ page }) => {
    await clearMailpit();
    const email = uniqueEmail();

    // Register (with verification required, lands on /verify-pending)
    await page.goto("/register");

    // Step 1: Account
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/^password$/i).fill(TEST_PASSWORD);
    await page.getByLabel(/confirm password/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 2: Encryption
    await page.getByLabel(/^encryption passphrase$/i).fill(TEST_PASSPHRASE);
    await page.getByLabel(/confirm passphrase/i).fill(TEST_PASSPHRASE);
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 3: Confirm
    await page.getByLabel(/i understand/i).check();
    await page.getByRole("button", { name: /create account/i }).click();
    await page.waitForURL("**/verify-pending", { timeout: 30_000 });

    // Fetch the verification link from Mailpit
    const verifyUrl = await fetchVerificationEmail(email);
    expect(verifyUrl).toContain("verify");

    // Navigate to the verification URL
    await page.goto(verifyUrl);

    // Should see success message
    await expect(
      page.getByText(/verified|success/i),
    ).toBeVisible({ timeout: 10_000 });
  });
});
