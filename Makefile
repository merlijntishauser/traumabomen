.PHONY: help up down nuke rebuild logs lint format typecheck ci test test-fe test-be coverage e2e \
       bump setup migrate migrate-up migrate-down privacy-scan

.DEFAULT_GOAL := help

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

# --- Development ---

up: ## Start all services (postgres + api + frontend)
	docker compose up

down: ## Stop all services (keeps database)
	docker compose down

nuke: ## Stop all services and delete database volume
	docker compose down -v

rebuild: ## Rebuild images from scratch and restart
	docker compose build --pull --no-cache
	docker compose up -d

logs: ## Follow service logs
	docker compose logs -f

# --- Code Quality ---

lint: ## Run linters (biome + ruff)
	cd frontend && npx @biomejs/biome check --diagnostic-level=error src/
	docker compose exec api uv run ruff check app/

format: ## Auto-format code (biome + ruff)
	cd frontend && npx @biomejs/biome check --write src/
	docker compose exec api uv run ruff format app/
	docker compose exec api uv run ruff check --fix app/

typecheck: ## Run type checkers (tsc + mypy)
	cd frontend && npx tsc --noEmit
	docker compose exec api uv run mypy app

ci: lint typecheck test privacy-scan ## Run full CI pipeline

# --- Testing ---

test: test-fe test-be ## Run all unit tests

test-fe: ## Run frontend tests (vitest)
	docker compose exec frontend npx vitest run

test-be: ## Run backend tests (pytest)
	docker compose exec api uv run pytest

coverage: ## Run tests with coverage reports
	docker compose exec frontend npx vitest run --coverage
	docker compose exec api uv run pytest --cov=app --cov-report=html --cov-report=term

e2e: ## Run end-to-end tests (playwright)
	docker compose exec frontend npx playwright test

# --- Deployment ---

bump: ## Tag a new version and push
	@LATEST=$$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0"); \
	MAJOR=$$(echo $$LATEST | sed 's/^v//' | cut -d. -f1); \
	MINOR=$$(echo $$LATEST | sed 's/^v//' | cut -d. -f2); \
	PATCH=$$(echo $$LATEST | sed 's/^v//' | cut -d. -f3); \
	NEXT_PATCH=$$((PATCH + 1)); \
	SUGGESTED="v$$MAJOR.$$MINOR.$$NEXT_PATCH"; \
	echo "Current version: $$LATEST"; \
	read -p "Next version [$$SUGGESTED]: " VERSION; \
	VERSION=$${VERSION:-$$SUGGESTED}; \
	echo "Tagging $$VERSION..."; \
	git tag "$$VERSION" && git push && git push --tags; \
	echo "Tagged and pushed $$VERSION"

# --- Database ---

migrate: ## Create migration (usage: make migrate M="description")
	docker compose exec api uv run alembic revision --autogenerate -m "$(M)"

migrate-up: ## Run pending migrations
	docker compose exec api uv run alembic upgrade head

migrate-down: ## Rollback last migration
	docker compose exec api uv run alembic downgrade -1

# --- Security ---

privacy-scan: ## Scan for leaked secrets and PII
	@bash scripts/privacy-scan.sh

# --- Setup ---

setup: ## Install dependencies and pre-commit hooks
	pre-commit install
	cd frontend && npm install
	docker compose exec api uv sync --extra dev 2>/dev/null || true
	@echo "Setup complete. Pre-commit hooks installed."
