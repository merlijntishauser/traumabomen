.PHONY: up down logs lint format typecheck ci test test-fe test-be coverage e2e \
       bump setup migrate migrate-up migrate-down privacy-scan

# --- Development ---

up:
	docker compose up

down:
	docker compose down -v

logs:
	docker compose logs -f

# --- Code Quality ---

lint:
	cd frontend && npx @biomejs/biome check src/
	cd api && uv run ruff check app/

format:
	cd frontend && npx @biomejs/biome check --write src/
	cd api && uv run ruff format app/
	cd api && uv run ruff check --fix app/

typecheck:
	cd frontend && npx tsc --noEmit
	cd api && uv run mypy app

ci: lint typecheck test privacy-scan

# --- Testing ---

test: test-fe test-be

test-fe:
	docker compose exec frontend npx vitest run

test-be:
	docker compose exec api uv run pytest

coverage:
	docker compose exec frontend npx vitest run --coverage
	docker compose exec api uv run pytest --cov=app --cov-report=html --cov-report=term

e2e:
	docker compose exec frontend npx playwright test

# --- Deployment ---

bump:
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

migrate:
	docker compose exec api uv run alembic revision --autogenerate -m "$(M)"

migrate-up:
	docker compose exec api uv run alembic upgrade head

migrate-down:
	docker compose exec api uv run alembic downgrade -1

# --- Security ---

privacy-scan:
	@bash scripts/privacy-scan.sh

# --- Setup ---

setup:
	pre-commit install
	cd frontend && npm install
	cd api && uv sync --extra dev
	@echo "Setup complete. Pre-commit hooks installed."
