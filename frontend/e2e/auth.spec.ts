import { test, expect } from "@playwright/test";
import {
  register,
  login,
  loginAndUnlock,
  logout,
  uniqueEmail,
  TEST_PASSWORD,
} from "./helpers/auth";

test.describe("Authentication @smoketest", () => {
  test("register and land on trees page", async ({ page }) => {
    const email = uniqueEmail();
    await register(page, email);
    await expect(page).toHaveURL(/\/trees$/);
  });

  test("login and unlock after registration", async ({ page }) => {
    const email = uniqueEmail();
    await register(page, email);
    await logout(page);
    await loginAndUnlock(page, email);
    await expect(page).toHaveURL(/\/trees$/);
  });

  test("wrong password shows error", async ({ page }) => {
    const email = uniqueEmail();
    await register(page, email);
    await logout(page);

    await page.goto("/login");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill("WrongPassword123!");
    await page.getByRole("button", { name: /log in/i }).click();

    await expect(page.locator(".auth-error")).toBeVisible();
  });

  test("wrong passphrase shows error", async ({ page }) => {
    const email = uniqueEmail();
    await register(page, email);
    await logout(page);

    await login(page, email);
    // AuthModal should appear in unlock mode
    const modal = page.locator("[role='dialog']");
    await modal.waitFor({ state: "visible", timeout: 10_000 });
    await modal.getByLabel(/passphrase/i).fill("wrong-passphrase-value");
    await modal.getByRole("button", { name: /unlock/i }).click();

    await expect(modal.locator(".auth-error")).toBeVisible();
  });

  test("logout redirects to login", async ({ page }) => {
    const email = uniqueEmail();
    await register(page, email);
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });
});
