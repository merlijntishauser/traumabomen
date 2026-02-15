# Quality Gates Design

## Goal

Add quality gates to CI that enforce code complexity limits and prevent coverage regressions. Coverage baselines ratchet upward over time. Pre-commit hooks stay unchanged (fast).

## Decisions

- **Enforcement:** CI only (GitHub Actions). Pre-commit stays lint + typecheck.
- **Python complexity:** Radon + Xenon (cyclomatic complexity + Maintainability Index).
- **TypeScript complexity:** ESLint + eslint-plugin-sonarjs (cognitive complexity).
- **Coverage gate:** Ratchet model with checked-in baseline file. Coverage must never decrease.
- **TypeScript baseline target:** 75% (requires writing tests to reach it from current 48.6%).
- **Python baseline:** 78% (current level).

## Tooling

### Python: Radon + Xenon

Add `radon` and `xenon` as dev dependencies in `api/pyproject.toml`.

Xenon enforces thresholds by wrapping radon:

```bash
xenon app/ --max-absolute C --max-modules B --max-average B
```

- `--max-absolute C`: No single function worse than C complexity (11-15 cyclomatic).
- `--max-modules B`: No module-level MI score worse than B.
- `--max-average B`: Average complexity across codebase stays at B or better.

### TypeScript: ESLint + sonarjs

Add `eslint`, `@eslint/js`, `typescript-eslint`, and `eslint-plugin-sonarjs` as dev dependencies in `frontend/package.json`.

Flat config (`eslint.config.js`):

- `sonarjs/cognitive-complexity`: error at threshold 15.
- `sonarjs/no-duplicate-string`: warn.
- `sonarjs/no-identical-functions`: warn.
- Lint `src/**/*.{ts,tsx}` only. Exclude test files from complexity rules.
- Disable all formatting rules to avoid overlap with Biome.

## Coverage Ratchet

### Baseline file: `.coverage-baseline.json`

Checked into the repository root:

```json
{
  "python": 78,
  "typescript": 75
}
```

### Ratchet script: `scripts/coverage-gate.sh`

Bash script that:

1. Reads the baseline from `.coverage-baseline.json`.
2. Parses coverage JSON output (jq).
3. Fails if new coverage < baseline.
4. Prints a reminder to bump the baseline if new coverage > baseline + 1.

### Vitest coverage configuration

Update `frontend/vitest.config.ts`:

```typescript
coverage: {
  provider: "v8",
  reporter: ["text", "json", "html"],
  exclude: [
    "**/*.css",
    "**/*.test.*",
    "e2e/**",
    "src/test/**",
    "src/i18n.ts",
    "src/main.tsx",
    "src/App.tsx",
    "src/vite-env.d.ts",
  ],
}
```

Excludes CSS files, test infrastructure, and app bootstrap files.

## CI Pipeline

Two new jobs in `.github/workflows/ci.yml`, running in parallel with existing jobs:

### `quality-be`

1. Checkout, install Python deps.
2. Run `xenon app/ --max-absolute C --max-modules B --max-average B`.
3. Run `pytest --cov=app --cov-report=json`.
4. Run `scripts/coverage-gate.sh python`.

### `quality-fe`

1. Checkout, `npm ci`.
2. Run `npx eslint src/`.
3. Run `npx vitest run --coverage` (JSON reporter).
4. Run `scripts/coverage-gate.sh typescript`.

## Makefile

- `make quality`: Run both complexity + coverage gates locally.
- `make ratchet`: Re-measure coverage and update `.coverage-baseline.json`.

## Tests to Write (reach 75% TypeScript coverage)

### Utility tests (pure functions, no mocks)

| File | Tests |
|------|-------|
| `src/lib/traumaColors.test.ts` | `getTraumaColor()` for each category |
| `src/lib/lifeEventColors.test.ts` | `getLifeEventColor()` for each category |
| `src/lib/classificationColors.test.ts` | `getClassificationColor()` for each status |
| `src/lib/dsmCategories.test.ts` | `DSM_CATEGORIES` structure, `getCategoryByKey()` |

### Hook tests (mocked API/crypto contexts)

| File | Tests |
|------|-------|
| `src/hooks/useTreeData.test.ts` | Query setup, decryption flow |
| `src/hooks/useTreeMutations.test.ts` | Mutation calls, optimistic updates, cache invalidation |
| `src/hooks/useTreeLayout.test.ts` | Node/edge generation from persons + relationships |

### Expanded component tests

| File | Tests |
|------|-------|
| `src/components/tree/PersonDetailPanel.test.tsx` | Classifications section, life events section |

## Implementation Order

1. Add Python dev deps (radon, xenon). Verify xenon passes on current code.
2. Add TypeScript dev deps (eslint, sonarjs). Create `eslint.config.js`. Verify passes.
3. Configure vitest coverage (exclude CSS, add JSON reporter).
4. Write utility tests (color helpers, DSM categories).
5. Write hook tests (useTreeData, useTreeMutations, useTreeLayout).
6. Expand PersonDetailPanel tests.
7. Verify coverage reaches 75%. Create `.coverage-baseline.json`.
8. Write `scripts/coverage-gate.sh`.
9. Add `quality-be` and `quality-fe` jobs to CI.
10. Add Makefile targets (`quality`, `ratchet`).
