import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:5173";
const IS_SMOKETEST = process.env.E2E_SMOKETEST === "true";

export default defineConfig({
  testDir: "./e2e",
  // Smoketest runs against a just-deployed (cold) Cloud Run instance and does a
  // full login -> cleanup -> create -> round-trip -> cleanup journey, so it
  // needs generous headroom; the local suite stays tight.
  timeout: IS_SMOKETEST ? 180_000 : 60_000,
  expect: { timeout: IS_SMOKETEST ? 30_000 : 10_000 },
  fullyParallel: true,
  workers: IS_SMOKETEST ? 1 : 3,
  retries: IS_SMOKETEST ? 2 : 1,
  // The smoketest runs against a live deployment: there is no test database
  // to reset, and only the production-safe smoke spec may run (the regular
  // suite registers throwaway users, which production must never allow).
  globalSetup: IS_SMOKETEST ? undefined : "./e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testMatch: IS_SMOKETEST ? /smoke-production\.spec\.ts/ : undefined,
      testIgnore: IS_SMOKETEST ? undefined : /smoke-production\.spec\.ts/,
    },
  ],
});
