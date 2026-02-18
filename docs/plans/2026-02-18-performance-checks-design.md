# Post-Deploy Performance Checks

## Overview

Lightweight performance tests that run after every production deploy to establish baselines and detect regressions. Covers both API response times and frontend load performance. Results are compared against a committed baseline file (same pattern as coverage gating). Warnings are logged but never block deployment.

## What we measure

### API (3 endpoints, warmed)

- `GET /health`: baseline for minimal overhead
- `POST /auth/login`: tests auth + DB path (using existing smoke test credentials)
- `GET /trees`: tests authenticated + encrypted data path

Each endpoint is hit 5 times after a warmup request (to exclude cold start). We record the median response time in milliseconds.

### Frontend

- **Bundle size**: sum of all JS files served by nginx, measured in KB. Fetched by parsing `<script>` tags from the HTML and summing `Content-Length` headers.
- **TTFB**: time-to-first-byte of the main page load. 3 requests, median.
- **Lighthouse performance score**: single headless Lighthouse run, performance category only (0-100).

## Baseline file

**`.performance-baseline.json`** in the repo root:

```json
{
  "api": {
    "health_ms": 45,
    "login_ms": 120,
    "trees_ms": 95
  },
  "frontend": {
    "bundle_size_kb": 320,
    "ttfb_ms": 180,
    "lighthouse_score": 92
  }
}
```

Updated via `make perf-ratchet`, same pattern as `make ratchet` for coverage.

## Comparison logic

For timing and size metrics, compare current value against baseline:

- **OK**: within 10% of baseline (or better)
- **WARN**: 10-50% worse than baseline
- **REGRESSED**: more than 50% worse

For Lighthouse score (already a 0-100 scale):

- **OK**: within 5 points of baseline
- **WARN**: 5-15 points lower
- **REGRESSED**: more than 15 points lower

Output is a table printed to stdout:

```
Metric              Baseline    Current     Status
health_ms           45          42          OK
login_ms            120         145         WARN (+21%)
trees_ms            95          90          OK
bundle_size_kb      320         318         OK
ttfb_ms             180         175         OK
lighthouse_score    92          88          WARN (-4pts)
```

The script always exits 0. Warnings are visible in the deploy log but never block deployment.

## Implementation

### scripts/performance-check.sh

Single bash script, called with the production base URL:

```bash
./scripts/performance-check.sh https://traumatrees.org
```

Steps:

1. Read test credentials from environment (`SMOKE_TEST_EMAIL`, `SMOKE_TEST_PASSWORD`)
2. Warmup: hit `/api/health` once, discard result
3. Measure API endpoints: 5 requests each via `curl -w '%{time_total}'`, collect median
4. Measure frontend TTFB: 3 requests to `/` via `curl -w '%{time_starttransfer}'`, collect median
5. Measure bundle size: fetch `/` HTML, extract JS `<script>` src paths, sum `Content-Length` headers
6. Run `lighthouse` in headless mode, parse performance score from JSON output
7. Read `.performance-baseline.json`, compare, print table
8. Write current results to `.performance-current.json` for `make perf-ratchet` to pick up

Dependencies: `curl`, `jq`, standard bash. Lighthouse and Chromium installed in the deploy runner.

### CI integration (deploy.yml)

Two new steps after the existing smoke tests:

```yaml
- name: Install Lighthouse
  run: npm install -g lighthouse chromium

- name: Performance check
  run: ./scripts/performance-check.sh https://traumatrees.org
  env:
    SMOKE_TEST_EMAIL: ${{ secrets.SMOKE_TEST_EMAIL }}
    SMOKE_TEST_PASSWORD: ${{ secrets.SMOKE_TEST_PASSWORD }}
    CHROME_PATH: $(npx chromium --path)
```

Lighthouse runs with `--chrome-flags="--headless --no-sandbox"`, `--only-categories=performance`, output as JSON.

Adds roughly 30 seconds to the deploy pipeline.

### Makefile

Two new targets:

- `make perf-check`: runs the script against production
- `make perf-ratchet`: runs the script then copies `.performance-current.json` to `.performance-baseline.json`

## Files

| File | Action |
|---|---|
| `scripts/performance-check.sh` | New |
| `.performance-baseline.json` | New (created by first run) |
| `.github/workflows/deploy.yml` | Add Lighthouse install + performance check step |
| `Makefile` | Add `perf-check` and `perf-ratchet` targets |
