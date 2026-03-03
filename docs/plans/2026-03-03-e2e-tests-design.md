# E2E Test Infrastructure Design

## Problem

Playwright e2e tests have been broken since early scaffolding. The frontend container is Alpine-based (node:25-alpine) which lacks the glibc system libraries Chromium needs. The single existing test is stale and uses selectors that no longer match the UI. E2e tests are not in CI.

## Solution

Dedicated Ubuntu-based Playwright container in docker-compose, new test suite covering all major user flows, and CI integration.

## Architecture

### E2E Container

New `e2e` service in docker-compose using the official Playwright Docker image (`mcr.microsoft.com/playwright:v1.49.0-noble`), which is Ubuntu-based with Chromium pre-installed.

```yaml
e2e:
  image: mcr.microsoft.com/playwright:v1.49.0-noble
  working_dir: /app
  volumes:
    - ./frontend:/app
  depends_on:
    - frontend
    - api
  profiles:
    - e2e
```

- Uses `profiles: [e2e]` so it doesn't start with `docker compose up`
- No custom Dockerfile; official image has Node, Chromium, and all system deps
- Mounts `./frontend` for test files and config
- Tests connect to `http://frontend:5173` (docker network)

### Playwright Configuration

Two modes via environment variables:

- `E2E_BASE_URL` defaults to `http://frontend:5173` (docker network). For future post-deploy smoketest, pass the production URL.
- `E2E_SMOKETEST=true` filters to tests tagged `@smoketest` (auth and tree workflow).
- `retries: 1` for flaky network/rendering, also enables trace capture.
- `screenshot: "only-on-failure"` for debugging.

### Test File Structure

```
frontend/e2e/
  global-setup.ts        # Reset database before test run
  helpers/
    auth.ts              # register(), login(), unlock()
    db.ts                # resetDatabase() via test API endpoint
    mailpit.ts           # fetchVerificationEmail() via Mailpit API
  auth.spec.ts           # @smoketest: register, login, wrong password, wrong passphrase, logout
  verification.spec.ts   # Email verification flow via Mailpit
  tree-workflow.spec.ts  # @smoketest: create tree, persons, relationships, persistence
  data-entry.spec.ts     # Trauma events, life events, classifications, turning points
  views.spec.ts          # Timeline, patterns, insights, journal navigation
  settings.spec.ts       # Password change, passphrase change, account deletion
```

- Shared helpers for auth, database reset, and Mailpit interaction. No page objects.
- `@smoketest` tag on auth and tree-workflow specs for the critical path subset.
- Each spec self-contained: registers its own user, creates its own tree. No ordering dependencies.

### Database Reset

Test-only backend endpoint for clean test runs:

```python
# api/app/routers/testing.py
@router.post("/test/reset", status_code=204)
```

Truncates all tables via `TRUNCATE ... CASCADE`. Guarded by `ENABLE_TEST_RESET=true` environment variable; the router is only registered in `main.py` when the env var is set. Not set in production. No auth required since the endpoint doesn't exist outside dev/e2e.

Global setup calls `POST /test/reset` before the test run via `E2E_API_URL` (defaults to `http://api:8000`).

### Email Verification

`REQUIRE_EMAIL_VERIFICATION=false` for most tests. One dedicated `verification.spec.ts` that:
1. Registers with verification enabled (or uses the default disabled flow and triggers resend)
2. Fetches the verification email from Mailpit's API (`http://mailpit:8025/api/v1/messages`)
3. Extracts the verification link
4. Navigates to it and confirms the account is verified

### CI Integration

New job in `.github/workflows/ci.yml`:

```yaml
e2e:
  name: E2E tests
  needs: [test-fe, test-be]
  runs-on: ubuntu-latest
```

- Runs after unit tests pass; no point running slow e2e if fast tests fail
- Uses GitHub native service containers for PostgreSQL
- Runs API and frontend directly (no docker-compose in CI)
- Uploads screenshots and traces as artifacts on failure
- Adds roughly 2-3 minutes to CI, only when unit tests pass

### Developer Workflow

```bash
docker compose up          # Normal dev: db, api, mailpit, frontend
make e2e                   # Spin up e2e container, run all tests, remove container
make e2e-headed            # Visual browser for debugging
make e2e-ui                # Playwright UI mode
```

### Cleanup

- Remove `@playwright/test` from frontend's `package.json` devDependencies
- Add `test-results/` and `playwright-report/` to frontend's `.gitignore`
- Delete the old `frontend/e2e/tree-workflow.spec.ts`
