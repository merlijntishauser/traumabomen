#!/usr/bin/env python3
"""Generate a markdown performance report from Locust CSV and DB stats.

Reads:
  - scripts/output/locust_stats.csv
  - scripts/output/db_stats_after.txt
  - scripts/output/docker_stats_before.txt
  - scripts/output/docker_stats_after.txt

Outputs:
  - scripts/output/perf-report-YYYY-MM-DD.md

Run from project root: python3 scripts/gen_perf_report.py
"""

import csv
import sys
from datetime import date
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent / "output"
LOCUST_CSV = OUTPUT_DIR / "locust_stats.csv"
DB_STATS = OUTPUT_DIR / "db_stats_after.txt"
DOCKER_BEFORE = OUTPUT_DIR / "docker_stats_before.txt"
DOCKER_AFTER = OUTPUT_DIR / "docker_stats_after.txt"

# Success criteria thresholds
P95_THRESHOLD_MS = 1000
P99_THRESHOLD_MS = 2000
ERROR_RATE_THRESHOLD = 1.0
THROUGHPUT_FLOOR_RPS = 50


def load_locust_stats() -> list[dict]:
    """Load and parse Locust CSV stats file."""
    if not LOCUST_CSV.exists():
        print(f"Error: {LOCUST_CSV} not found. Run load test first.")
        sys.exit(1)

    rows = []
    with LOCUST_CSV.open() as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows


def categorize_endpoint(name: str) -> str:
    """Map a Locust request name to an endpoint category."""
    if "sync" in name.lower():
        return "POST /sync"
    if "admin" in name.lower():
        return "GET /admin/*"
    if name.startswith("GET"):
        return "GET /trees/*"
    return "Other"


def build_latency_table(rows: list[dict]) -> tuple[str, dict]:
    """Build the latency markdown table grouped by endpoint category.

    Returns (table_str, aggregated_row) where aggregated_row has
    the Aggregated row data for criteria checks.
    """
    categories: dict[str, list[dict]] = {}
    aggregated_row = {}

    for row in rows:
        name = row.get("Name", "")
        if name == "Aggregated":
            aggregated_row = row
            continue
        cat = categorize_endpoint(name)
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(row)

    lines = [
        "| Endpoint Group | Requests | p50 (ms) | p95 (ms) | p99 (ms) | RPS | Error % |",
        "|----------------|----------|----------|----------|----------|-----|---------|",
    ]

    for cat in ["GET /trees/*", "POST /sync", "GET /admin/*", "Other"]:
        cat_rows = categories.get(cat, [])
        if not cat_rows:
            continue

        total_requests = sum(int(r.get("Request Count", 0)) for r in cat_rows)
        total_failures = sum(int(r.get("Failure Count", 0)) for r in cat_rows)
        error_pct = (total_failures / total_requests * 100) if total_requests else 0

        # Weighted average for percentiles (use max across endpoints as conservative)
        p50 = max((float(r.get("50%", 0)) for r in cat_rows), default=0)
        p95 = max((float(r.get("95%", 0)) for r in cat_rows), default=0)
        p99 = max((float(r.get("99%", 0)) for r in cat_rows), default=0)
        rps = sum(float(r.get("Requests/s", 0)) for r in cat_rows)

        lines.append(
            f"| {cat} | {total_requests} | {p50:.0f} | {p95:.0f} | {p99:.0f} | {rps:.1f} | {error_pct:.2f}% |"
        )

    # Aggregated totals
    if aggregated_row:
        lines.append(
            f"| **Total** | {aggregated_row.get('Request Count', 'N/A')} "
            f"| {float(aggregated_row.get('50%', 0)):.0f} "
            f"| {float(aggregated_row.get('95%', 0)):.0f} "
            f"| {float(aggregated_row.get('99%', 0)):.0f} "
            f"| {float(aggregated_row.get('Requests/s', 0)):.1f} "
            f"| {calc_error_pct(aggregated_row):.2f}% |"
        )

    return "\n".join(lines), aggregated_row


def calc_error_pct(row: dict) -> float:
    """Calculate error percentage from a stats row."""
    total = int(row.get("Request Count", 0))
    failures = int(row.get("Failure Count", 0))
    return (failures / total * 100) if total else 0


def build_criteria_checklist(aggregated: dict) -> str:
    """Build PASS/FAIL checklist against success criteria."""
    if not aggregated:
        return "No aggregated data available.\n"

    p95 = float(aggregated.get("95%", 0))
    p99 = float(aggregated.get("99%", 0))
    error_pct = calc_error_pct(aggregated)
    rps = float(aggregated.get("Requests/s", 0))

    checks = [
        (f"p95 latency < {P95_THRESHOLD_MS}ms", p95, p95 < P95_THRESHOLD_MS),
        (f"p99 latency < {P99_THRESHOLD_MS}ms", p99, p99 < P99_THRESHOLD_MS),
        (f"Error rate < {ERROR_RATE_THRESHOLD}%", error_pct, error_pct < ERROR_RATE_THRESHOLD),
        (f"Throughput >= {THROUGHPUT_FLOOR_RPS} RPS", rps, rps >= THROUGHPUT_FLOOR_RPS),
    ]

    lines = []
    for label, value, passed in checks:
        status = "PASS" if passed else "FAIL"
        lines.append(f"- [{status}] {label} (actual: {value:.1f})")

    return "\n".join(lines)


def load_text_file(path: Path) -> str:
    """Load a text file, returning placeholder if missing."""
    if path.exists():
        return path.read_text().strip()
    return "(not captured)"


def generate_report() -> str:
    """Generate the full performance report markdown."""
    today = date.today().isoformat()
    rows = load_locust_stats()
    latency_table, aggregated = build_latency_table(rows)
    criteria = build_criteria_checklist(aggregated)
    db_stats = load_text_file(DB_STATS)
    docker_before = load_text_file(DOCKER_BEFORE)
    docker_after = load_text_file(DOCKER_AFTER)

    report = f"""# Performance Report: {today}

## Environment

- Docker local, 1 API instance, PostgreSQL 17
- Locust: 20 users, 1 user/s spawn rate, 7 min run

## Latency

{latency_table}

## Success Criteria

{criteria}

## Top DB Queries (by total execution time)

```
{db_stats}
```

## Resource Usage

### Before load test

```
{docker_before}
```

### After load test

```
{docker_after}
```

## Bottlenecks

(Manual analysis; review the latency table and DB queries above for candidates.)
"""
    return report


def main() -> None:
    report = generate_report()
    today = date.today().isoformat()
    output_path = OUTPUT_DIR / f"perf-report-{today}.md"
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path.write_text(report)
    print(f"Report written to {output_path}")


if __name__ == "__main__":
    main()
