# CI & Code Quality Design

## Overview

Add linting, formatting, type-checking, pre-commit hooks, CI workflows, CodeQL, Dependabot, and a custom privacy scanner to the Traumabomen project.

## Tools

| Area | Tool | Why |
|------|------|-----|
| Frontend lint/format | Biome | Single tool, Rust-based, fast |
| Backend lint/format | Ruff | Single tool, Rust-based, fast |
| Backend type-check | mypy | Standard Python type checker |
| Frontend type-check | tsc --noEmit | Already available |
| Pre-commit | pre-commit framework | Self-managing, language-agnostic |
| SAST | CodeQL | GitHub-native, JS/TS + Python |
| Dependencies | Dependabot | Automated CVE alerts + PRs |
| Privacy | Custom script | Zero-knowledge-specific checks |

## Makefile

Single entry point for all dev operations. Wraps Docker Compose commands.

```makefile
# Development
make up              # docker compose up
make down            # docker compose down -v
make logs            # docker compose logs -f

# Quality
make lint            # biome check (fe) + ruff check (be)
make format          # biome format --write + ruff format
make typecheck       # tsc --noEmit (fe) + mypy (be)
make ci              # lint + typecheck + test

# Testing
make test            # vitest run + pytest
make test-fe         # vitest run only
make test-be         # pytest only
make coverage        # vitest --coverage + pytest --cov

# Deployment
make bump            # Interactive: read latest tag, propose next, confirm/override, tag + push

# Database
make migrate M="desc"  # alembic revision --autogenerate
make migrate-up        # alembic upgrade head
make migrate-down      # alembic downgrade -1

# Setup
make setup           # Install pre-commit hooks, verify tools
```

### `make bump` behavior

1. Read latest git tag (e.g. `v0.1.18`)
2. Parse semver, increment patch -> `v0.1.19`
3. Prompt: `Next version [v0.1.19]:`
4. Accept with Enter, or type override (e.g. `v0.2.0`)
5. `git tag $VERSION && git push && git push --tags`

## Pre-commit Hooks

Using the pre-commit framework (pre-commit.com).

`.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/biomejs/pre-commit
    rev: v1.9.0
    hooks:
      - id: biome-check
        additional_dependencies: ["@biomejs/biome@1.9.0"]
        args: [--write]

  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format

  - repo: local
    hooks:
      - id: tsc
        name: TypeScript type-check
        entry: bash -c 'cd frontend && npx tsc --noEmit'
        language: system
        files: '\.tsx?$'
        pass_filenames: false

      - id: mypy
        name: mypy type-check
        entry: bash -c 'cd api && uv run mypy app'
        language: system
        files: '\.py$'
        pass_filenames: false
```

Setup: `pre-commit install` (included in `make setup`).

## GitHub CI Workflow

`.github/workflows/ci.yml` -- runs on push to main + PRs.

Jobs (all parallel):

1. **lint-fe** -- `biome ci frontend/`
2. **lint-be** -- `ruff check api/ && ruff format --check api/`
3. **typecheck-fe** -- `cd frontend && npx tsc --noEmit`
4. **typecheck-be** -- `cd api && uv run mypy app`
5. **test-fe** -- `cd frontend && npx vitest run --coverage`
6. **test-be** -- `cd api && uv run pytest --cov --cov-report=xml` (with postgres service container)
7. **privacy-scan** -- `scripts/privacy-scan.sh`

## CodeQL

`.github/workflows/codeql.yml`:

- Triggers: push to main, PRs, weekly schedule
- Languages: javascript-typescript, python
- Uses default CodeQL query suites (security-extended)
- Results in GitHub Security tab

## Dependabot

`.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /frontend
    schedule: { interval: weekly }
  - package-ecosystem: pip
    directory: /api
    schedule: { interval: weekly }
  - package-ecosystem: docker
    directory: /frontend
    schedule: { interval: monthly }
  - package-ecosystem: docker
    directory: /api
    schedule: { interval: monthly }
  - package-ecosystem: github-actions
    directory: /
    schedule: { interval: weekly }
```

## Privacy Scanner

`scripts/privacy-scan.sh` -- custom zero-knowledge violation detector.

### Checks

1. **Plaintext data in logs**: `console.log`/`console.debug` containing decrypted variable names
2. **Unsafe storage**: `localStorage.setItem`/`sessionStorage.setItem` with non-allowlisted keys
3. **Crypto misuse**: Hardcoded IVs, key material in string literals, encrypt/decrypt usage outside crypto module
4. **Sensitive data in URLs**: Person names or event data in route definitions
5. **Server-side leaks**: API code referencing decrypted content or logging encrypted_data fields

### Allowlisted localStorage keys

- `traumabomen-theme`
- `traumabomen-canvas-settings`
- `traumabomen-mobile-dismissed`
- `i18nextLng`

### Implementation

Shell script using grep/ripgrep patterns. Each check category returns specific error messages. Non-zero exit on any violation. False positives managed via inline `# privacy-ok` comments and an allowlist file.

## Files to Create/Modify

| # | File | Action |
|---|------|--------|
| 1 | `Makefile` | CREATE |
| 2 | `.pre-commit-config.yaml` | CREATE |
| 3 | `biome.json` | CREATE (frontend config) |
| 4 | `frontend/biome.json` | CREATE (Biome config for frontend) |
| 5 | `api/pyproject.toml` | MODIFY (add ruff + mypy config) |
| 6 | `.github/workflows/ci.yml` | CREATE |
| 7 | `.github/workflows/codeql.yml` | CREATE |
| 8 | `.github/dependabot.yml` | CREATE |
| 9 | `scripts/privacy-scan.sh` | CREATE |

## Verification

1. `make lint` passes (may need initial formatting fixes)
2. `make typecheck` passes
3. `make test` passes
4. `make ci` runs all three above
5. `make bump` prompts for version interactively
6. `git commit` triggers pre-commit hooks (biome, ruff, tsc, mypy)
7. Push to main triggers CI workflow
8. CodeQL appears in GitHub Security tab
9. Dependabot creates PRs for outdated dependencies
10. Privacy scan catches intentional violations (test with a `console.log(personName)`)
