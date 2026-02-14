# Contributing

Thanks for your interest in contributing to Traumabomen.

## Development Setup

1. Install [Docker](https://docs.docker.com/get-docker/) and Docker Compose
2. Clone the repo and set up your environment:

```bash
git clone https://github.com/merlijntishauser/traumabomen.git
cd traumabomen
cp .env.example .env
make setup
```

This installs pre-commit hooks (Biome, Ruff, TypeScript, mypy) and project dependencies. No local Node.js or Python installation required -- everything runs in Docker.

3. Start the development environment:

```bash
make up
```

## Pre-commit Hooks

The following checks run automatically on every commit:

- **Biome** -- lint and format frontend code
- **Ruff** -- lint and format backend code
- **TypeScript** -- type checking
- **mypy** -- Python type checking

If a hook fails, fix the issue and re-commit. Run `make ci` to check everything manually.

## Making Changes

### Branch Naming

Use descriptive branch names:

- `feat/add-timeline-zoom` -- new features
- `fix/login-token-refresh` -- bug fixes
- `refactor/encryption-module` -- refactoring

### Code Style

**Frontend (TypeScript/React):**
- TypeScript strict mode is enabled
- Biome handles formatting and linting
- Use functional components with hooks
- All UI strings must go through `react-i18next` (`t('key')`) -- no hardcoded user-facing text
- Add translations to both `en` and `nl` locale files

**Backend (Python):**
- Ruff handles formatting and linting
- Follow existing FastAPI patterns
- Use async endpoints
- Type hints on all function signatures

### Security Rules

These are non-negotiable:

- Never store or log encryption keys or passphrases
- Never send plaintext sensitive data to the backend
- All sensitive fields must be encrypted client-side before any API call
- Encryption keys must only exist in memory -- never in localStorage, sessionStorage, or cookies
- Every `encrypt()` call must use a fresh random IV

See [SECURITY.md](SECURITY.md) for the full security policy.

### Database Changes

If your change modifies the database schema:

```bash
make migrate M="short description"   # Generate migration
make migrate-up                      # Apply migration
```

Always review the generated migration file before committing.

## Testing

Run the full CI suite before submitting a PR:

```bash
make ci    # lint + typecheck + test + privacy scan
```

Or run individual test suites:

```bash
make test-be    # Backend (pytest)
make test-fe    # Frontend (Vitest)
make e2e        # End-to-end (Playwright)
make coverage   # Tests with coverage reports
```

### What to Test

- **Encryption module:** round-trip encrypt/decrypt, IV uniqueness
- **Components:** render states, CRUD interactions
- **API endpoints:** encrypted blobs stored and returned untouched, auth flows
- **Integration:** full user journeys through the app

## Pull Requests

- Keep PRs focused -- one feature or fix per PR
- Include a clear description of what changed and why
- Make sure `make ci` passes
- Update translations if you added or changed UI strings
