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
  // The local suite does not retry: a retry that turns a red run green hides
  // real bugs (it masked a person-name data-loss race). The smoketest keeps
  // its retries, where the flakiness is a cold remote deployment, not us.
  retries: IS_SMOKETEST ? 2 : 0,
  // The smoketest runs against a live deployment: there is no test database
  // to reset, and only the production-safe smoke spec may run (the regular
  // suite registers throwaway users, which production must never allow).
  globalSetup: IS_SMOKETEST ? undefined : "./e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    // Without retries there is no second attempt to trace, so keep the trace
    // from the failing run itself.
    trace: IS_SMOKETEST ? "on-first-retry" : "retain-on-failure",
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
