# E2E Test Infrastructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the broken e2e test infrastructure with a dedicated Playwright Ubuntu container, write tests covering all major user flows, and integrate into CI.

**Architecture:** A new `e2e` docker-compose service using the official Playwright image (Ubuntu + Chromium pre-installed) runs tests against the existing frontend dev server at `http://frontend:5173`. A test-only `POST /test/reset` backend endpoint truncates all tables between runs. Tests are self-contained (each spec registers its own user) and tagged `@smoketest` for future post-deploy use.

**Tech Stack:** Playwright (Chromium), docker-compose profiles, FastAPI test endpoint, GitHub Actions CI

**Design doc:** `docs/plans/2026-03-03-e2e-tests-design.md`

---

### Task 1: Backend test reset endpoint

Add a guarded endpoint that truncates all database tables for e2e test isolation.

**Files:**
- Create: `api/app/routers/testing.py`
- Modify: `api/app/config.py` (add `ENABLE_TEST_RESET` setting)
- Modify: `api/app/main.py` (conditionally register router)
- Test: `api/tests/test_testing.py`

**Step 1: Add setting to config**

In `api/app/config.py`, add to the `Settings` class:

```python
ENABLE_TEST_RESET: bool = False
```

**Step 2: Create the testing router**

Create `api/app/routers/testing.py`:

```python
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import Base, get_db

router = APIRouter()


@router.post("/test/reset", status_code=204)
async def reset_database(db: AsyncSession = Depends(get_db)) -> None:
    for table in reversed(Base.metadata.sorted_tables):
        await db.execute(text(f"TRUNCATE {table.name} CASCADE"))
    await db.commit()
```

**Step 3: Conditionally register in main.py**

In `api/app/main.py`, after the existing router includes, add:

```python
if _settings.ENABLE_TEST_RESET:
    from app.routers.testing import router as testing_router
    app.include_router(testing_router)
```

**Step 4: Write backend test**

Create `api/tests/test_testing.py`:

```python
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_reset_endpoint_truncates_tables(client: AsyncClient, user):
    """POST /test/reset should remove all rows from all tables."""
    resp = await client.post("/test/reset")
    assert resp.status_code == 204

    # Verify user was deleted
    login_resp = await client.post("/auth/login", json={
        "email": user.email,
        "password": "TestPassword1!",
    })
    assert login_resp.status_code == 401
```

The test works because the test backend uses `ENABLE_TEST_RESET=true` (set in the test conftest environment). Check if conftest already sets env vars or if ENABLE_TEST_RESET needs to be injected. The test fixture `user` creates a user, and after reset it should be gone.

**Step 5: Run tests**

```bash
docker compose exec api uv run pytest tests/test_testing.py -v
docker compose exec api uv run mypy app/
docker compose exec api uv run bandit -r app/
```

**Step 6: Commit**

```
feat: add test-only database reset endpoint for e2e isolation
```

---

### Task 2: Docker and Makefile infrastructure

Add the e2e service to docker-compose, update gitignore, and update Makefile targets.

**Files:**
- Modify: `docker-compose.yml` (add e2e service, add `ENABLE_TEST_RESET` to api)
- Modify: `.gitignore` (add playwright-report/)
- Modify: `Makefile` (replace e2e target, add e2e-headed and e2e-ui)

**Step 1: Add e2e service and env var to docker-compose.yml**

Add `ENABLE_TEST_RESET=true` to the api service environment, and add the e2e service:

```yaml
  api:
    build:
      context: ./api
      target: dev
    volumes:
      - ./api:/app
    ports:
      - "8000:8000"
    env_file: .env
    environment:
      - ENABLE_TEST_RESET=true
    depends_on:
      db:
        condition: service_healthy
    command: uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  e2e:
    image: mcr.microsoft.com/playwright:v1.49.0-noble
    working_dir: /app
    volumes:
      - ./frontend:/app
      - /app/node_modules
    depends_on:
      - frontend
      - api
    profiles:
      - e2e
```

Note the `/app/node_modules` anonymous volume to prevent overwriting the container's node_modules with the host's (same pattern as the frontend service).

**Step 2: Add playwright-report to .gitignore**

In `.gitignore`, add under the existing `frontend/test-results/` line:

```
frontend/playwright-report/
```

**Step 3: Update Makefile**

Replace the existing `e2e` target and add new targets:

```makefile
e2e: ## Run end-to-end tests (playwright)
	docker compose --profile e2e run --rm e2e npx playwright test

e2e-headed: ## Run e2e tests with visible browser
	docker compose --profile e2e run --rm e2e npx playwright test --headed

e2e-ui: ## Open Playwright UI mode
	docker compose --profile e2e run --rm e2e npx playwright test --ui
```

Also update the `.PHONY` line to include `e2e-headed e2e-ui`.

**Step 4: Verify infrastructure works**

```bash
# Pull the Playwright image
docker compose --profile e2e pull e2e

# Verify the e2e container can reach the frontend
docker compose --profile e2e run --rm e2e curl -s http://frontend:5173 | head -5

# Verify the reset endpoint is registered
docker compose exec api curl -s -X POST http://localhost:8000/test/reset -w "%{http_code}"
```

**Step 5: Commit**

```
feat: add e2e docker service and Makefile targets
```

---

### Task 3: Playwright config and helpers

Replace the old Playwright config and create shared test helpers.

**Files:**
- Rewrite: `frontend/playwright.config.ts`
- Create: `frontend/e2e/global-setup.ts`
- Create: `frontend/e2e/helpers/auth.ts`
- Create: `frontend/e2e/helpers/db.ts`
- Create: `frontend/e2e/helpers/mailpit.ts`
- Delete: `frontend/e2e/tree-workflow.spec.ts` (old test)
- Modify: `frontend/package.json` (remove @playwright/test from devDependencies, remove test:e2e script)

**Step 1: Rewrite playwright.config.ts**

```typescript
import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL || "http://frontend:5173";
const IS_SMOKETEST = process.env.E2E_SMOKETEST === "true";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 1,
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      grep: IS_SMOKETEST ? /@smoketest/ : undefined,
    },
  ],
});
```

**Step 2: Create global-setup.ts**

```typescript
async function globalSetup() {
  const apiUrl = process.env.E2E_API_URL || "http://api:8000";
  const response = await fetch(`${apiUrl}/test/reset`, { method: "POST" });
  if (!response.ok) {
    throw new Error(`Database reset failed: ${response.status}`);
  }
}

export default globalSetup;
```

**Step 3: Create helpers/db.ts**

```typescript
const API_URL = process.env.E2E_API_URL || "http://api:8000";

export async function resetDatabase(): Promise<void> {
  const response = await fetch(`${API_URL}/test/reset`, { method: "POST" });
  if (!response.ok) {
    throw new Error(`Database reset failed: ${response.status}`);
  }
}
```

**Step 4: Create helpers/auth.ts**

```typescript
import type { Page } from "@playwright/test";

export const TEST_PASSWORD = "TestPassword123!";
export const TEST_PASSPHRASE = "my-secure-test-passphrase";

let emailCounter = 0;

export function uniqueEmail(): string {
  emailCounter++;
  return `e2e-${Date.now()}-${emailCounter}@example.com`;
}

export async function register(page: Page, email: string): Promise<void> {
  await page.goto("/register");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password$/i).fill(TEST_PASSWORD);
  await page.getByLabel(/confirm password/i).fill(TEST_PASSWORD);
  await page.getByLabel(/^encryption passphrase$/i).fill(TEST_PASSPHRASE);
  await page.getByLabel(/confirm passphrase/i).fill(TEST_PASSPHRASE);
  await page.getByLabel(/i understand/i).check();
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL("**/trees", { timeout: 30_000 });
}

export async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /log in/i }).click();
}

export async function unlock(page: Page): Promise<void> {
  await page.getByLabel(/passphrase/i).fill(TEST_PASSPHRASE);
  await page.getByRole("button", { name: /unlock/i }).click();
  await page.waitForURL("**/trees", { timeout: 30_000 });
}

export async function loginAndUnlock(page: Page, email: string): Promise<void> {
  await login(page, email);
  await unlock(page);
}
```

**Step 5: Create helpers/mailpit.ts**

```typescript
const MAILPIT_URL = process.env.E2E_MAILPIT_URL || "http://mailpit:8025";

interface MailpitMessage {
  ID: string;
  To: Array<{ Address: string }>;
  Subject: string;
}

interface MailpitResponse {
  messages: MailpitMessage[];
}

export async function fetchVerificationEmail(
  email: string,
  maxRetries = 10,
): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=10`);
    const data: MailpitResponse = await response.json();

    const message = data.messages.find((m) =>
      m.To.some((to) => to.Address === email),
    );

    if (message) {
      const htmlResponse = await fetch(
        `${MAILPIT_URL}/api/v1/message/${message.ID}`,
      );
      const detail = await htmlResponse.json();
      const body: string = detail.HTML || detail.Text || "";
      const linkMatch = body.match(/href="([^"]*verify[^"]*)"/);
      if (linkMatch) return linkMatch[1];
    }

    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No verification email found for ${email}`);
}

export async function clearMailpit(): Promise<void> {
  await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: "DELETE" });
}
```

**Step 6: Delete old test and clean up package.json**

Delete `frontend/e2e/tree-workflow.spec.ts`.

In `frontend/package.json`, remove `"@playwright/test": "^1.49.0"` from devDependencies and remove the `"test:e2e": "playwright test"` script.

**Step 7: Verify helpers compile**

```bash
docker compose --profile e2e run --rm e2e npx tsc --noEmit -p tsconfig.json
```

If tsconfig doesn't cover e2e files (it likely excludes them), just verify the e2e container can find and parse the config:

```bash
docker compose --profile e2e run --rm e2e npx playwright test --list
```

(Should show 0 tests since we deleted the old spec and haven't written new ones yet.)

**Step 8: Commit**

```
feat: replace Playwright config and add e2e test helpers
```

---

### Task 4: Auth spec (smoketest)

Write the auth flow tests. Tag with `@smoketest`. Use the MCP Playwright browser to verify selectors against the running app before writing tests.

**Files:**
- Create: `frontend/e2e/auth.spec.ts`

**Step 1: Use MCP browser to verify auth page selectors**

Navigate to `http://localhost:5173/register` and `http://localhost:5173/login` with the MCP Playwright browser. Verify:
- Label text for email, password, confirm password, encryption passphrase, confirm passphrase fields
- The "I understand" checkbox label
- The "Create account" button text
- The "Log in" button text
- The passphrase unlock page label and button text
- What happens on wrong password (error message text)
- What happens on wrong passphrase (error message text/behavior)
- How logout works (settings panel? direct link?)

**Step 2: Write auth.spec.ts**

```typescript
import { test, expect } from "@playwright/test";
import {
  register,
  login,
  loginAndUnlock,
  unlock,
  uniqueEmail,
  TEST_PASSWORD,
  TEST_PASSPHRASE,
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

    // Logout (find the actual logout mechanism via MCP browser)
    // ... logout steps here ...

    await loginAndUnlock(page, email);
    await expect(page).toHaveURL(/\/trees$/);
  });

  test("wrong password shows error", async ({ page }) => {
    const email = uniqueEmail();
    await register(page, email);
    // ... logout ...

    await page.goto("/login");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill("WrongPassword123!");
    await page.getByRole("button", { name: /log in/i }).click();

    // Verify error message appears (check actual text via MCP)
    await expect(page.getByRole("alert")).toBeVisible();
  });

  test("wrong passphrase shows error", async ({ page }) => {
    const email = uniqueEmail();
    await register(page, email);
    // ... logout ...

    await login(page, email);
    await page.getByLabel(/passphrase/i).fill("wrong-passphrase");
    await page.getByRole("button", { name: /unlock/i }).click();

    // Verify error (check actual behavior via MCP)
    await expect(page.getByText(/incorrect|wrong|failed/i)).toBeVisible();
  });

  test("logout redirects to login", async ({ page }) => {
    const email = uniqueEmail();
    await register(page, email);

    // ... logout steps (verify via MCP) ...

    await expect(page).toHaveURL(/\/login/);
  });
});
```

**Important:** The exact selectors for logout, error messages, and the unlock page MUST be verified via the MCP Playwright browser before finalizing this spec. The code above has placeholder comments where MCP verification is needed.

**Step 3: Run the test**

```bash
docker compose --profile e2e run --rm e2e npx playwright test auth.spec.ts
```

**Step 4: Commit**

```
test: add auth e2e tests with smoketest tag
```

---

### Task 5: Tree workflow spec (smoketest)

Write the core tree workflow test. Tag with `@smoketest`. Use MCP browser to verify all selectors.

**Files:**
- Create: `frontend/e2e/tree-workflow.spec.ts`

**Step 1: Use MCP browser to verify tree workspace selectors**

After registering and creating a tree, verify via MCP browser:
- "Create tree" button on `/trees` page
- "Add person" button on tree canvas
- Detail panel selector (class name)
- Name input, birth year input in detail panel
- Save button text/selector in detail panel
- How to close the panel (Escape? Close button?)
- Person node selector and text content
- Relationship drag handles (source/target)
- Relationship type popover and options
- Edge selector for verifying connections

**Step 2: Write tree-workflow.spec.ts**

```typescript
import { test, expect } from "@playwright/test";
import { register, loginAndUnlock, uniqueEmail } from "./helpers/auth";

test.describe("Tree workflow @smoketest", () => {
  test("create tree, add persons, create relationship, verify persistence", async ({ page }) => {
    const email = uniqueEmail();
    await register(page, email);

    // Create tree
    await page.getByRole("button", { name: /create tree/i }).click();
    await page.waitForURL("**/trees/*");

    // Add person Alice (verify selectors via MCP)
    // ... add person flow ...

    // Add person Bob
    // ... add person flow ...

    // Verify both visible
    // ... node assertions ...

    // Create relationship (drag handles - verify via MCP)
    // ... drag-to-connect flow ...

    // Logout and re-login
    // ... logout flow ...
    await loginAndUnlock(page, email);

    // Navigate to tree
    // ... click tree link ...

    // Verify persistence
    // ... assertions on nodes and edges ...
  });
});
```

**Important:** Every selector in this file must be verified via MCP browser first. The old test's selectors (`.detail-panel`, `.person-node`, `.react-flow__handle-bottom`, `.relationship-popover`) may or may not still be valid.

**Step 3: Run the test**

```bash
docker compose --profile e2e run --rm e2e npx playwright test tree-workflow.spec.ts
```

**Step 4: Commit**

```
test: add tree workflow e2e test with smoketest tag
```

---

### Task 6: Verification spec (Mailpit)

Test the email verification flow end-to-end using Mailpit's API.

**Files:**
- Create: `frontend/e2e/verification.spec.ts`

**Step 1: Use MCP browser to verify the verification pending page**

Navigate to `/verify-pending` and check:
- What text is shown
- Is there a "resend" button
- What does the verification URL path look like

**Step 2: Write verification.spec.ts**

```typescript
import { test, expect } from "@playwright/test";
import { uniqueEmail, TEST_PASSWORD, TEST_PASSPHRASE } from "./helpers/auth";
import { fetchVerificationEmail, clearMailpit } from "./helpers/mailpit";

test.describe("Email verification", () => {
  test("register with verification, confirm via email link", async ({ page }) => {
    await clearMailpit();
    const email = uniqueEmail();

    // Register (this will send a verification email via Mailpit)
    await page.goto("/register");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/^password$/i).fill(TEST_PASSWORD);
    await page.getByLabel(/confirm password/i).fill(TEST_PASSWORD);
    await page.getByLabel(/^encryption passphrase$/i).fill(TEST_PASSPHRASE);
    await page.getByLabel(/confirm passphrase/i).fill(TEST_PASSPHRASE);
    await page.getByLabel(/i understand/i).check();
    await page.getByRole("button", { name: /create account/i }).click();

    // Note: with REQUIRE_EMAIL_VERIFICATION=false, registration goes straight
    // to /trees. The verification email is still sent though.
    // If verification is disabled, we can test that resend-verification works
    // by checking Mailpit received the initial email.

    // Fetch the verification link from Mailpit
    const verifyUrl = await fetchVerificationEmail(email);

    // Navigate to the verification URL
    await page.goto(verifyUrl);

    // Should see a success message or redirect (verify via MCP)
    await expect(page.getByText(/verified|success/i)).toBeVisible();
  });
});
```

**Important:** This test depends on whether `REQUIRE_EMAIL_VERIFICATION` is true or false in the e2e environment. With `false` (the default), registration still sends a verification email but doesn't block login. The test should verify the Mailpit email arrives and the verification link works regardless. Check the actual behavior via MCP browser.

**Step 3: Run the test**

```bash
docker compose --profile e2e run --rm e2e npx playwright test verification.spec.ts
```

**Step 4: Commit**

```
test: add email verification e2e test via Mailpit
```

---

### Task 7: Data entry spec

Test adding trauma events, life events, classifications, and turning points.

**Files:**
- Create: `frontend/e2e/data-entry.spec.ts`

**Step 1: Use MCP browser to verify detail panel data entry selectors**

After creating a tree and a person, verify via MCP:
- Tab navigation in the detail panel (Events tab, Classifications tab)
- "New event" button for trauma events
- Event form fields (title, category dropdown, approximate date, severity)
- Save button in event form
- Life events sub-tab and form
- Turning points sub-tab and form
- Classification form (DSM category dropdown, status radio, diagnosis year)
- Badge appearances on person node after adding events

**Step 2: Write data-entry.spec.ts**

Test structure (each test registers fresh user, creates tree and person):

```typescript
import { test, expect } from "@playwright/test";
import { register, uniqueEmail } from "./helpers/auth";

// Helper to create a tree with one person (reused across tests)
async function setupTreeWithPerson(page) { ... }

test.describe("Data entry", () => {
  test("add trauma event to person", async ({ page }) => { ... });
  test("add life event to person", async ({ page }) => { ... });
  test("add turning point to person", async ({ page }) => { ... });
  test("add classification to person", async ({ page }) => { ... });
});
```

**Important:** All selectors must be verified via MCP browser. The detail panel uses tabs now, not expandable sections.

**Step 3: Run**

```bash
docker compose --profile e2e run --rm e2e npx playwright test data-entry.spec.ts
```

**Step 4: Commit**

```
test: add data entry e2e tests for events, classifications, turning points
```

---

### Task 8: Views spec

Test that all view pages load and render content.

**Files:**
- Create: `frontend/e2e/views.spec.ts`

**Step 1: Use MCP browser to verify view navigation**

After creating a tree with some data, verify via MCP:
- Tab bar selectors (Canvas, Timeline, Patterns, Journal, Insights)
- Timeline page: does it render an SVG? Are person labels visible?
- Patterns page: what does the empty state look like?
- Journal page: what does the empty state look like?
- Insights page: what does the empty state look like?

**Step 2: Write views.spec.ts**

```typescript
import { test, expect } from "@playwright/test";
import { register, uniqueEmail } from "./helpers/auth";

test.describe("Views", () => {
  test("timeline view renders persons", async ({ page }) => { ... });
  test("patterns view shows empty state", async ({ page }) => { ... });
  test("journal view shows empty state", async ({ page }) => { ... });
  test("insights view shows empty state", async ({ page }) => { ... });
});
```

**Step 3: Run**

```bash
docker compose --profile e2e run --rm e2e npx playwright test views.spec.ts
```

**Step 4: Commit**

```
test: add view navigation e2e tests
```

---

### Task 9: Settings spec

Test password change, passphrase change, and account deletion.

**Files:**
- Create: `frontend/e2e/settings.spec.ts`

**Step 1: Use MCP browser to verify settings panel**

Verify via MCP:
- How to open the settings panel (gear icon? menu?)
- Settings panel tabs (if any)
- Password change form fields and button
- Passphrase change form fields and button
- Account deletion section (confirmation text, password field, delete button)

**Step 2: Write settings.spec.ts**

```typescript
import { test, expect } from "@playwright/test";
import { register, loginAndUnlock, uniqueEmail, TEST_PASSWORD } from "./helpers/auth";

test.describe("Settings", () => {
  test("change password and login with new password", async ({ page }) => { ... });
  test("change passphrase and unlock with new passphrase", async ({ page }) => { ... });
  test("delete account", async ({ page }) => { ... });
});
```

**Step 3: Run**

```bash
docker compose --profile e2e run --rm e2e npx playwright test settings.spec.ts
```

**Step 4: Commit**

```
test: add settings e2e tests for password, passphrase, account deletion
```

---

### Task 10: CI integration

Add e2e job to GitHub Actions CI workflow.

**Files:**
- Modify: `.github/workflows/ci.yml` (add e2e job)

**Step 1: Add e2e job**

Add after the existing jobs in `.github/workflows/ci.yml`:

```yaml
  e2e:
    name: E2E tests
    needs: [test-fe, test-be]
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: traumabomen_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U test"
          --health-interval 5s
          --health-timeout 3s
          --health-retries 5
    env:
      DATABASE_URL: postgresql+asyncpg://test:test@localhost:5432/traumabomen_test
      JWT_SECRET_KEY: e2e-test-secret-key
      ENABLE_TEST_RESET: "true"
      REQUIRE_EMAIL_VERIFICATION: "false"
      CORS_ORIGINS: http://localhost:5173
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - uses: astral-sh/setup-uv@v7
      - uses: actions/setup-python@v6
        with:
          python-version: "3.13"

      - name: Install backend
        working-directory: api
        run: uv sync --extra dev

      - name: Run migrations
        working-directory: api
        run: uv run alembic upgrade head

      - name: Start API
        working-directory: api
        run: uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 &

      - name: Install frontend
        working-directory: frontend
        run: npm ci

      - name: Start frontend
        working-directory: frontend
        run: npx vite dev --host 0.0.0.0 --port 5173 &

      - name: Install Playwright
        working-directory: frontend
        run: npx playwright install chromium

      - name: Wait for services
        run: |
          timeout 30 bash -c 'until curl -s http://localhost:8000/health > /dev/null; do sleep 1; done'
          timeout 30 bash -c 'until curl -s http://localhost:5173 > /dev/null; do sleep 1; done'

      - name: Run e2e tests
        working-directory: frontend
        env:
          E2E_BASE_URL: http://localhost:5173
          E2E_API_URL: http://localhost:8000
          E2E_MAILPIT_URL: ""
        run: npx playwright test --grep-invert "@verification"

      - name: Upload test artifacts
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-results
          path: |
            frontend/test-results/
            frontend/playwright-report/
          retention-days: 7
```

Note: the CI job skips `verification.spec.ts` (grep-invert on `@verification` tag) because there's no Mailpit service in CI. The verification test runs locally only.

**Step 2: Tag the verification spec**

In `frontend/e2e/verification.spec.ts`, make sure the describe block includes `@verification` in its title:

```typescript
test.describe("Email verification @verification", () => {
```

**Step 3: Commit**

```
ci: add e2e test job to GitHub Actions workflow
```

---

### Task 11: Final verification and cleanup

Run the full suite, verify everything works end-to-end.

**Step 1: Run full e2e suite locally**

```bash
make e2e
```

All specs should pass.

**Step 2: Run existing unit tests to verify no regressions**

```bash
docker compose exec frontend npx vitest run
docker compose exec api uv run pytest
docker compose exec frontend npx tsc --noEmit
docker compose exec api uv run mypy app/
```

**Step 3: Run quality gates**

```bash
make quality
```

**Step 4: Commit any final fixes, then commit the design doc update**

```
docs: finalize e2e test implementation
```
