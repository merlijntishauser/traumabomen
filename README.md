# Traumabomen

A zero-knowledge encrypted web app for mapping intergenerational trauma onto visual family trees. Built as a personal reflection tool -- all sensitive data is encrypted client-side before it ever reaches the server.

**Live at [traumatrees.org](https://traumatrees.org) and [traumabomen.nl](https://www.traumabomen.nl)**

## How It Works

- Build a family tree with people, relationships, and life events
- Annotate trauma events across generations to surface patterns
- Visualize the tree and a generational timeline side by side
- Everything is encrypted with a passphrase only you know -- the server stores opaque ciphertext

**If you lose your passphrase, your data is unrecoverable.** This is by design.

## Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | Vite, React, TypeScript, React Flow, D3.js, TanStack Query |
| Backend | FastAPI, SQLAlchemy, PostgreSQL |
| Encryption | AES-256-GCM via Web Crypto API, Argon2id key derivation |
| Auth | JWT (access + refresh tokens) via PyJWT |
| i18n | English + Dutch |
| Infrastructure | Google Cloud Run, Artifact Registry, Cloud SQL |

## Getting Started

Prerequisites: [Docker](https://docs.docker.com/get-docker/) and Docker Compose.

```bash
git clone https://github.com/merlijntishauser/traumabomen.git
cd traumabomen
cp .env.example .env   # Edit secrets as needed
make setup             # Install pre-commit hooks and dependencies
make up                # Start all services
```

This starts four containers:

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | Vite dev server with hot-reload |
| API | http://localhost:8000 | FastAPI with auto-reload |
| Database | localhost:5432 | PostgreSQL 17 |
| Mailpit | http://localhost:8025 | Local email testing UI |

The frontend proxies `/api/*` requests to the backend automatically.

## Make Targets

Run `make help` to see all available targets:

| Target | Description |
|--------|-------------|
| `make up` | Start all services |
| `make down` | Stop all services (keeps database) |
| `make nuke` | Stop all services and delete database volume |
| `make rebuild` | Rebuild images from scratch and restart |
| `make ci` | Run full CI pipeline (lint, typecheck, test, privacy scan) |
| `make test` | Run all unit tests |
| `make coverage` | Run tests with coverage reports |
| `make e2e` | Run end-to-end tests (Playwright) |
| `make lint` | Run linters (Biome + Ruff) |
| `make format` | Auto-format code |
| `make typecheck` | Run type checkers (tsc + mypy) |
| `make migrate M="desc"` | Create a database migration |
| `make migrate-up` | Run pending migrations |
| `make migrate-down` | Rollback last migration |
| `make bump` | Tag a new version and push |
| `make privacy-scan` | Scan for leaked secrets and PII |

## Project Structure

```
traumabomen/
  docker-compose.yml        Local dev orchestration
  .env.example              Environment variable template
  Makefile                  Development and CI commands
  .pre-commit-config.yaml   Pre-commit hook configuration
  frontend/                 React + TypeScript SPA
    Dockerfile              Multi-stage: dev / build / production
    src/                    Application source
  api/                      FastAPI backend
    Dockerfile              Multi-stage: dev / production
    app/                    Application source
    alembic/                Database migrations
  .github/workflows/        CI, CodeQL, deploy pipelines
  docs/                     Design documents
```

## Production

Deployed on Google Cloud Run. Each service has a `production` Docker target:

```bash
docker build --target production -t traumabomen-frontend ./frontend   # nginx on :8080
docker build --target production -t traumabomen-api ./api             # uvicorn on :8000
```

Deployments are triggered by pushing a version tag (`make bump`).

## Security

See [SECURITY.md](SECURITY.md) for our vulnerability reporting policy.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).
