# Load Testing and Profiling

## Goal

Establish a reusable performance baseline before scaling. Provide a harness that can be re-run after changes to detect regressions and identify bottlenecks.

## Test Data Tiers

Three tree sizes with proportional entity counts:

| Tier   | Persons | Relationships | Trauma Events | Life Events | Classifications |
|--------|---------|---------------|---------------|-------------|-----------------|
| Small  | 8       | 10            | 5             | 4           | 2               |
| Medium | 30      | 40            | 20            | 15          | 8               |
| Large  | 80      | 110           | 50            | 40          | 20              |

Medium mirrors the typical user (15-40 persons). Large is ~2.5x medium for stress testing. Small is for quick smoke tests.

## Seed Script

`scripts/seed_perf_data.py` runs against the local Docker API.

- Creates two accounts via `POST /auth/register`: `perf-user@test.local` and `perf-admin@test.local`. Admin flag set via direct DB update.
- Logs in to get JWT tokens.
- For each tier, calls `POST /trees` then `POST /trees/{id}/sync` with a single bulk payload containing all persons, relationships, and events.
- Encrypted data fields are deterministic placeholder strings (`"perf-blob-person-1"`, etc.); the server treats them as opaque.
- Idempotent: skips account creation if email already exists (409), deletes and recreates trees by convention-named metadata.
- Outputs `scripts/perf_accounts.json` with tokens and tree IDs for Locust to consume.
- Uses `httpx` (already available in the test suite).

## Locust Scenarios

Directory: `loadtests/` at project root.

`loadtests/locustfile.py` defines four task classes weighted by realistic usage:

| Scenario           | Weight | Description                                                              |
|--------------------|--------|--------------------------------------------------------------------------|
| `ReadTreeData`     | 50     | GET persons, relationships, events for a random tier tree                |
| `SyncMixedPayload` | 25     | POST sync with 3-5 person updates + 1-2 event creates + 1 delete        |
| `DragSavePositions`| 15     | POST sync with `persons_update` only (8-15 position changes)            |
| `AdminStats`       | 10     | GET admin/stats/overview, usage, activity (admin token)                  |

Each scenario logs in once at `on_start` using credentials from `perf_accounts.json`. The admin scenario uses the admin account; others use the normal user.

## Success Criteria

Conservative targets for local Docker (single-instance, no replication). These are baseline numbers, not production SLAs.

| Metric                    | Target     |
|---------------------------|------------|
| p50 latency (reads)       | < 100ms    |
| p50 latency (sync)        | < 300ms    |
| p95 latency (all)         | < 1s       |
| p99 latency (all)         | < 2s       |
| Error rate                | < 1%       |
| Sustained concurrency     | 20 users   |
| Throughput floor           | 50 RPS     |

If anything exceeds these on the first run, that is a finding to investigate, not a failure.

Run duration: 2 minutes warmup (ramp 0 to 20 users) + 5 minutes steady state.

## Profiling and Observability

Three layers, all opt-in:

### API profiling

`make profile-api` restarts the API container with `py-spy` attached in sampling mode. Writes a flamegraph SVG to `scripts/output/flamegraph.svg`. Run during a Locust session to capture hot paths.

### DB profiling

`pg_stat_statements` enabled in docker-compose Postgres config (`shared_preload_libraries`). A `scripts/db_query_stats.sql` script snapshots the top 20 queries by total time. Run before and after a load test to diff.

### Container metrics

`make perf-metrics` runs `docker stats --no-stream` at start and end of a test, capturing CPU/memory snapshots.

## Report Format

Each run produces `scripts/output/perf-report-YYYY-MM-DD.md`:

```markdown
## Run: YYYY-MM-DD

### Environment
- Docker local, 1 API instance, PostgreSQL 16

### Latency (ms)
| Endpoint Group  | p50 | p95 | p99 | RPS |
|-----------------|-----|-----|-----|-----|
| GET /trees/*    |     |     |     |     |
| POST /sync      |     |     |     |     |
| GET /admin/*    |     |     |     |     |

### Top DB Queries (by total time)
| Query (truncated) | Calls | Mean (ms) | Total (ms) |
|--------------------|-------|-----------|------------|
|                    |       |           |            |

### Bottlenecks
1. ...

### Resource Usage
| Container | CPU peak | Memory peak |
|-----------|----------|-------------|
|           |          |             |
```

`scripts/gen_perf_report.py` merges Locust CSV stats with the DB stats snapshot into this template.

## File Structure

```
loadtests/
  locustfile.py         Scenario definitions
  requirements.txt      locust pinned version
scripts/
  seed_perf_data.py     Idempotent test data seeder
  gen_perf_report.py    Merge Locust + DB stats into report
  db_query_stats.sql    pg_stat_statements snapshot query
  output/               Generated reports, flamegraphs (gitignored)
```

## Makefile Targets

```makefile
perf-seed:      Run seed script to create test accounts and trees
perf-load:      Run Locust headless (20 users, 7 min)
perf-metrics:   Snapshot container CPU/memory
perf-report:    Generate markdown report from latest run
profile-api:    Restart API with py-spy and write flamegraph
```
