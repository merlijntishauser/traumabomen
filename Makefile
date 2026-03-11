-include .env
export

.PHONY: help up down nuke rebuild logs lint format typecheck ci test test-fe test-fe-unit test-fe-integration test-be test-be-unit test-be-integration coverage e2e e2e-headed e2e-ui e2e-verify \
       bump setup migrate migrate-up migrate-down privacy-scan quality ratchet complexity react-doctor perf-check perf-ratchet \
       perf-seed perf-load perf-metrics perf-report profile-api

.DEFAULT_GOAL := help

help: ## Show this help
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' Makefile | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

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

react-doctor: ## Run React Doctor health check (minimum score: 95)
	@SCORE=$$(cd frontend && npx -y react-doctor@latest . --score -y 2>/dev/null | tail -1); \
	echo "React Doctor score: $$SCORE / 100 (minimum: 95)"; \
	if [ "$$SCORE" -lt 95 ] 2>/dev/null; then \
		echo "FAIL: React Doctor score $$SCORE is below minimum 95"; \
		cd frontend && npx -y react-doctor@latest . --verbose -y; \
		exit 1; \
	fi

ci: lint typecheck privacy-scan quality react-doctor ## Run full CI pipeline

# --- Testing ---

test: test-fe test-be ## Run all unit tests

test-fe: ## Run all frontend tests (unit + integration)
	docker compose exec frontend npx vitest run

test-fe-unit: ## Run fast frontend unit tests only (no DOM)
	docker compose exec frontend npx vitest run --project unit

test-fe-integration: ## Run frontend integration tests (jsdom)
	docker compose exec frontend npx vitest run --project integration

test-be: ## Run all backend tests (unit + integration)
	docker compose exec api uv run pytest

test-be-unit: ## Run fast backend unit tests only (no DB)
	docker compose exec api uv run pytest tests/unit/

test-be-integration: ## Run backend integration tests (DB + HTTP)
	docker compose exec api uv run pytest tests/integration/

coverage: ## Run tests with coverage reports
	docker compose exec frontend npx vitest run --coverage
	docker compose exec api uv run pytest --cov=app --cov-report=html --cov-report=term

e2e: ## Run end-to-end tests (playwright)
	docker compose --profile e2e run --rm e2e sh -c 'npm ci --ignore-scripts ; node e2e/port-forward.cjs & sleep 1 ; node node_modules/@playwright/test/cli.js test'

e2e-headed: ## Run e2e tests with visible browser (local)
	cd frontend && npx playwright test --headed

e2e-ui: ## Open Playwright UI mode (local)
	cd frontend && npx playwright test --ui

e2e-verify: ## Run e2e verification test (email flow)
	docker compose -f docker-compose.yml -f docker-compose.verify.yml up -d api
	@sleep 3
	docker compose -f docker-compose.yml -f docker-compose.verify.yml --profile e2e run --rm -e E2E_VERIFICATION=true e2e sh -c 'npm ci --ignore-scripts ; node e2e/port-forward.cjs & sleep 1 ; node node_modules/@playwright/test/cli.js test --grep @verification' ; \
	EXIT=$$? ; docker compose up -d api ; exit $$EXIT

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

# --- Quality Gates ---

complexity: ## Report cyclomatic complexity and maintainability index
	@bash scripts/complexity-report.sh

quality: ## Run complexity checks and coverage gates
	docker compose exec api uv run xenon app/ --max-absolute B --max-modules B --max-average A
	docker compose exec frontend npx eslint src/
	docker compose exec api uv run pytest tests/unit/ -q
	docker compose exec api uv run pytest --cov=app --cov-report=json -q
	docker compose exec frontend npx vitest run --project unit
	docker compose exec frontend npx vitest run --coverage
	@bash scripts/coverage-gate.sh python
	@bash scripts/coverage-gate.sh typescript

ratchet: ## Update coverage baseline to current values
	docker compose exec api uv run pytest --cov=app --cov-report=json -q
	docker compose exec frontend npx vitest run --coverage
	@PY=$$(docker compose exec api python3 -c "import json; d=json.load(open('coverage.json')); print(int(d['totals']['percent_covered']))"); \
	TS_STMT=$$(docker compose exec frontend node -e "const d=require('./coverage/coverage-summary.json'); console.log(Math.floor(d.total.statements.pct))"); \
	TS_LINE=$$(docker compose exec frontend node -e "const d=require('./coverage/coverage-summary.json'); console.log(Math.floor(d.total.lines.pct))"); \
	echo "{\"python\": $$PY, \"typescript_statements\": $$TS_STMT, \"typescript_lines\": $$TS_LINE}" > .coverage-baseline.json; \
	echo "Updated baseline: python=$$PY% typescript statements=$$TS_STMT% lines=$$TS_LINE%"

# --- Performance ---

perf-check: ## Run performance checks against production
	@bash scripts/performance-check.sh https://www.traumatrees.org

perf-ratchet: ## Update performance baseline to current production values
	@bash scripts/performance-check.sh https://www.traumatrees.org
	@if [ "$${CI:-false}" = "true" ]; then \
		cp .performance-current.json .performance-baseline.ci.json; \
		echo "CI performance baseline updated."; \
	else \
		cp .performance-current.json .performance-baseline.json; \
		echo "Local performance baseline updated."; \
	fi

# --- Load Testing ---

perf-seed: ## Seed performance test data
	docker compose exec -T db psql -U traumabomen -d traumabomen -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;" 2>/dev/null || true
	python3 scripts/seed_perf_data.py

perf-load: ## Run Locust headless (20 users, 7 min)
	@mkdir -p scripts/output
	docker stats --no-stream > scripts/output/docker_stats_before.txt
	docker compose exec -T db psql -U traumabomen -d traumabomen -c "SELECT pg_stat_statements_reset();" 2>/dev/null || true
	locust -f loadtests/locustfile.py --host=http://localhost:8000 --users=20 --spawn-rate=1 --run-time=7m --headless --csv=scripts/output/locust --only-summary
	docker stats --no-stream > scripts/output/docker_stats_after.txt
	docker compose exec -T db psql -U traumabomen -d traumabomen -f /dev/stdin < scripts/db_query_stats.sql > scripts/output/db_stats_after.txt

perf-metrics: ## Snapshot container CPU/memory
	docker stats --no-stream

perf-report: ## Generate markdown report from latest run
	python3 scripts/gen_perf_report.py

profile-api: ## Attach py-spy to API container for flamegraph
	@mkdir -p scripts/output
	docker compose exec --privileged api py-spy record --pid 1 --format speedscope --output /app/scripts/output/flamegraph.json --duration 300

# --- Security ---

privacy-scan: ## Scan for leaked secrets and PII
	@bash scripts/privacy-scan.sh

# --- Setup ---

setup: ## Install dependencies and pre-commit hooks
	git config --unset-all core.hooksPath 2>/dev/null || true
	pre-commit install
	cd frontend && npm install
	docker compose exec api uv sync --extra dev 2>/dev/null || true
	@echo "Setup complete. Pre-commit hooks installed."
