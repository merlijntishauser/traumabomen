# Post-Deploy Security Scanning (ZAP + Nuclei)

## Context

Traumabomen handles sensitive mental health data with zero-knowledge encryption. While client-side encryption protects data at rest, the web application surface (auth endpoints, API routes, headers, TLS config) remains exposed. Automated security scanning after each production deploy catches regressions before they become vulnerabilities.

## Decision

Add a `security-scan` job to the deploy pipeline (`deploy.yml`) that runs OWASP ZAP and ProjectDiscovery Nuclei against the live production URL after the smoketest passes. Findings at high or critical severity fail the pipeline. Reports are uploaded as artifacts for review.

## Architecture

### Pipeline Position

```
build-api + build-frontend
        |
      deploy
        |
     smoketest        (existing: health + login checks, ~30s)
        |
   security-scan      (new: ZAP + Nuclei, ~3-8 min)
```

The security scan runs only on version tag deploys (`v*`), matching the existing trigger. It depends on `smoketest` to confirm the deployment is healthy before scanning.

### ZAP Baseline Scan

OWASP ZAP performs an authenticated passive scan of the application:

1. A setup step calls `/api/auth/login` with SMOKETEST credentials to obtain a JWT.
2. ZAP spiders from `https://www.traumatrees.org` with the JWT injected as an `Authorization` header, reaching protected endpoints (`/trees`, `/persons`, `/relationships`, etc.).
3. ZAP passively analyzes all responses for OWASP Top 10 issues: XSS, injection, information disclosure, missing security headers, insecure cookies, etc.
4. A rules file (`.zap/rules.tsv`) suppresses known false positives (encrypted blobs flagged as information disclosure, SPA client-side routing).

Uses the official `zaproxy/action-baseline` action. Estimated runtime: 2-5 minutes.

### Nuclei Scan

Nuclei runs community-maintained templates for fast, broad coverage:

- **Severity filter**: `critical,high` only -- medium/low/info are excluded to avoid noise.
- **Template tags**: `cve`, `misconfig`, `exposure`, `tech`. The `dos` tag is explicitly excluded.
- **Rate limiting**: 10 requests/second to avoid triggering Cloud Run autoscaling costs.
- **Targets**: Both `traumatrees.org` and `traumabomen.nl` to verify consistent security posture across domains.

Runs as a Docker container (`projectdiscovery/nuclei:latest`). Estimated runtime: 1-2 minutes.

### Failure Handling

- ZAP: A post-scan step parses the JSON report and counts alerts with `riskcode` 3 (high) or 4 (critical). Any match fails the job with a summary printed to the Actions log.
- Nuclei: The JSONL output is grep'd for `critical` or `high` severity entries. Any match fails the job.
- Both reports (ZAP HTML + Nuclei JSONL) upload as artifacts with 30-day retention via `upload-artifact@v4` with `if: always()`, ensuring reports are available even on failure.

## Implementation

### New files

| File | Purpose |
|------|---------|
| `.zap/rules.tsv` | ZAP alert suppression rules (false positives) |

### Modified files

| File | Change |
|------|--------|
| `.github/workflows/deploy.yml` | Add `security-scan` job after `smoketest` |

### deploy.yml: security-scan job

```yaml
security-scan:
  needs: [smoketest]
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v6

    - name: Obtain auth token
      id: auth
      env:
        SMOKETEST_EMAIL: ${{ secrets.SMOKETEST_EMAIL }}
        SMOKETEST_PASSWORD: ${{ secrets.SMOKETEST_PASSWORD }}
      run: |
        TOKEN=$(curl -sf -X POST \
          -H "Content-Type: application/json" \
          -d "{\"email\":\"${SMOKETEST_EMAIL}\",\"password\":\"${SMOKETEST_PASSWORD}\"}" \
          "https://www.traumatrees.org/api/auth/login" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
        echo "::add-mask::${TOKEN}"
        echo "token=${TOKEN}" >> "$GITHUB_OUTPUT"

    - name: ZAP Baseline Scan
      uses: zaproxy/action-baseline@v0.14.0
      with:
        target: "https://www.traumatrees.org"
        rules_file_name: ".zap/rules.tsv"
        cmd_options: >-
          -z '-config replacer.full_list(0).matchtype=REQ_HEADER
          -config replacer.full_list(0).matchstr=Authorization
          -config replacer.full_list(0).replacement=Bearer ${{ steps.auth.outputs.token }}'
        fail_action: "warn"
        artifact_name: ""

    - name: Check ZAP results
      run: |
        python3 -c "
        import json, sys
        with open('results/zap-report.json') as f:
          data = json.load(f)
        blockers = [a for a in data.get('site', [{}])[0].get('alerts', [])
                    if a.get('riskcode', '0') in ('3', '4')]
        for a in blockers:
          level = 'HIGH' if a['riskcode'] == '3' else 'CRITICAL'
          print(f'  [{level}] {a[\"name\"]}')
          for i in a.get('instances', [])[:3]:
            print(f'    {i.get(\"method\",\"\")} {i.get(\"uri\",\"\")}')
        if blockers:
          print(f'::error::{len(blockers)} high/critical ZAP findings')
          sys.exit(1)
        print('No high/critical ZAP findings')
        "

    - name: Nuclei Scan
      run: |
        mkdir -p results
        docker run --rm \
          -v ${{ github.workspace }}/results:/output \
          projectdiscovery/nuclei:latest \
          -u "https://www.traumatrees.org" \
          -u "https://www.traumabomen.nl" \
          -severity critical,high \
          -tags cve,misconfig,exposure,tech \
          -exclude-tags dos \
          -rate-limit 10 \
          -jsonl -output /output/nuclei-report.jsonl

        if grep -q '"severity":"critical"\|"severity":"high"' results/nuclei-report.jsonl 2>/dev/null; then
          echo "::error::Nuclei found critical/high severity issues"
          python3 -c "
        import sys, json
        for line in open('results/nuclei-report.jsonl'):
          f = json.loads(line)
          print(f'  [{f[\"info\"][\"severity\"].upper()}] {f[\"info\"][\"name\"]} - {f.get(\"matched-at\", \"\")}')
        "
          exit 1
        fi
        echo "No critical/high Nuclei findings"

    - name: Upload scan reports
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: security-scan-reports
        path: results/
        retention-days: 30
```

### .zap/rules.tsv

Initial suppressions (refined after first run):

```tsv
10038	IGNORE	(Content Security Policy)	# CSP configured at Cloud Run/nginx level
10098	IGNORE	(Cross-Domain Misconfiguration)	# Expected: API and frontend on same domain via proxy
90033	IGNORE	(Loosely Scoped Cookie)	# JWT in Authorization header, not cookies
```

## Verification

After implementation:

1. Push a version tag to trigger the deploy pipeline.
2. Confirm the `security-scan` job appears after `smoketest` in the Actions UI.
3. Verify ZAP and Nuclei reports appear as downloadable artifacts.
4. Review initial findings and tune `.zap/rules.tsv` for any false positives.
5. Confirm the job fails correctly by temporarily removing a security header and redeploying.
