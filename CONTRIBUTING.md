# Contributing

Thanks for your interest in contributing to Traumabomen.

## Development Setup

1. Install [Docker](https://docs.docker.com/get-docker/) and Docker Compose
2. Clone the repo and set up your environment:

```bash
git clone https://github.com/your-username/traumabomen.git
cd traumabomen
cp .env.example .env
```

3. Start the development environment:

```bash
docker compose up
```

All three services (frontend, API, database) start with hot-reload enabled. No local Node.js or Python installation required.

## Making Changes

### Branch Naming

Use descriptive branch names:

- `feat/add-timeline-zoom` -- new features
- `fix/login-token-refresh` -- bug fixes
- `refactor/encryption-module` -- refactoring

### Code Style

**Frontend (TypeScript/React):**
- TypeScript strict mode is enabled
- Use functional components with hooks
- All UI strings must go through `react-i18next` (`t('key')`) -- no hardcoded user-facing text
- Add translations to both `en` and `nl` locale files

**Backend (Python):**
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

### Database Changes

If your change modifies the database schema:

```bash
# Generate a migration after modifying SQLAlchemy models
docker compose exec api uv run alembic revision --autogenerate -m "short description"

# Test the migration applies cleanly
docker compose exec api uv run alembic upgrade head
```

Always review the generated migration file before committing.

## Testing

Run the relevant tests before submitting a PR:

```bash
# Backend
docker compose exec api uv run pytest

# Frontend unit/component tests
docker compose exec frontend npx vitest run

# Frontend e2e tests
docker compose exec frontend npx playwright test
```

### What to Test

- **Encryption module:** round-trip encrypt/decrypt, IV uniqueness
- **Components:** render states, CRUD interactions
- **API endpoints:** encrypted blobs stored and returned untouched, auth flows
- **Integration:** full user journeys through the app

## Pull Requests

- Keep PRs focused -- one feature or fix per PR
- Include a clear description of what changed and why
- Make sure all tests pass
- Update translations if you added or changed UI strings
