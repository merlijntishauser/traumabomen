# Traumabomen

A zero-knowledge encrypted web app for mapping intergenerational trauma onto visual family trees. Built as a personal reflection tool -- all sensitive data is encrypted client-side before it ever reaches the server.

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
| Auth | JWT (access + refresh tokens) |
| i18n | English + Dutch |

## Getting Started

Prerequisites: [Docker](https://docs.docker.com/get-docker/) and Docker Compose.

```bash
# Clone and configure
git clone https://github.com/your-username/traumabomen.git
cd traumabomen
cp .env.example .env   # Edit secrets as needed

# Start all services
docker compose up
```

This starts three containers:

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | Vite dev server with hot-reload |
| API | http://localhost:8000 | FastAPI with auto-reload |
| Database | localhost:5432 | PostgreSQL 17 |

The frontend proxies `/api/*` requests to the backend automatically.

## Project Structure

```
traumabomen/
  docker-compose.yml        Local dev orchestration
  .env.example              Environment variable template
  frontend/                 React + TypeScript SPA
    Dockerfile              Multi-stage: dev / build / production
    src/                    Application source
  api/                      FastAPI backend
    Dockerfile              Multi-stage: dev / production
    app/                    Application source
    alembic/                Database migrations
  docs/                     Design documents
```

## Running Tests

```bash
# Backend
docker compose exec api uv run pytest

# Frontend unit/component tests
docker compose exec frontend npx vitest run

# Frontend end-to-end tests
docker compose exec frontend npx playwright test
```

## Database Migrations

```bash
# Create a migration
docker compose exec api uv run alembic revision --autogenerate -m "description"

# Apply migrations
docker compose exec api uv run alembic upgrade head
```

## Production

Each service has a `production` Docker target with hardened base images:

```bash
docker build --target production -t traumabomen-frontend ./frontend   # nginx on :8080
docker build --target production -t traumabomen-api ./api             # uvicorn on :8000, non-root
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).
