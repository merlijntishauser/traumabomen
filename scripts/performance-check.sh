#!/usr/bin/env bash
#
# Post-deploy performance check.
# Measures API response times, frontend TTFB, bundle size, and Lighthouse score.
# Compares results against .performance-baseline.json and prints a summary table.
# Always exits 0 (warnings never block deployment).
#
# Usage:
#   ./scripts/performance-check.sh https://www.traumatrees.org
#
# Environment:
#   SMOKETEST_EMAIL    - test account email
#   SMOKETEST_PASSWORD - test account password
#   CHROME_PATH        - path to Chrome/Chromium binary (optional, for Lighthouse)

set -euo pipefail

BASE_URL="${1:?Usage: $0 <base-url>}"
API_URL="${BASE_URL}/api"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
if [ "${CI:-false}" = "true" ]; then
  BASELINE_FILE="$ROOT_DIR/.performance-baseline.ci.json"
else
  BASELINE_FILE="$ROOT_DIR/.performance-baseline.json"
fi
CURRENT_FILE="$ROOT_DIR/.performance-current.json"

# Populated after authentication
ACCESS_TOKEN=""

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

median_ms() {
  # Read time values in seconds from stdin (one per line),
  # sort, pick the median, convert to integer milliseconds.
  sort -n | awk '{a[NR]=$1} END {
    mid = a[int((NR+1)/2)]
    printf "%d", mid * 1000
  }'
}

measure_endpoint() {
  local url="$1"
  local method="${2:-GET}"
  local body="${3:-}"
  local auth="${4:-false}"
  local samples="${5:-5}"

  local curl_args=(-sf -o /dev/null -w '%{time_total}')
  if [ "$method" = "POST" ]; then
    curl_args+=(-X POST -H "Content-Type: application/json" -d "$body")
  fi
  if [ "$auth" = "true" ] && [ -n "$ACCESS_TOKEN" ]; then
    curl_args+=(-H "Authorization: Bearer $ACCESS_TOKEN")
  fi

  local times=()
  for _ in $(seq 1 "$samples"); do
    local t
    t=$(curl "${curl_args[@]}" "$url" 2>/dev/null || echo "0")
    times+=("$t")
  done

  printf '%s\n' "${times[@]}" | median_ms
}

measure_ttfb() {
  local url="$1"
  local samples="${2:-3}"

  local times=()
  for _ in $(seq 1 "$samples"); do
    local t
    t=$(curl -sf -o /dev/null -w '%{time_starttransfer}' "$url" 2>/dev/null || echo "0")
    times+=("$t")
  done

  printf '%s\n' "${times[@]}" | median_ms
}

measure_bundle_size() {
  local url="$1"

  local html
  html=$(curl -sf "$url" 2>/dev/null || echo "")
  if [ -z "$html" ]; then
    echo "0"
    return
  fi

  local total_bytes=0
  local srcs
  srcs=$(echo "$html" | grep -oE 'src="[^"]*\.js"' | sed 's/src="//;s/"$//' || true)

  for src in $srcs; do
    local full_url
    if [[ "$src" == http* ]]; then
      full_url="$src"
    else
      full_url="${url%/}/${src#/}"
    fi

    local size
    size=$(curl -sfI "$full_url" 2>/dev/null \
      | grep -i '^content-length:' \
      | awk '{print $2}' \
      | tr -d '\r' || echo "0")
    if [ -n "$size" ] && [ "$size" -gt 0 ] 2>/dev/null; then
      total_bytes=$((total_bytes + size))
    fi
  done

  echo $((total_bytes / 1024))
}

measure_lighthouse() {
  local url="$1"
  local tmpfile
  tmpfile=$(mktemp /tmp/lh-XXXXXX.json)

  if command -v lighthouse &>/dev/null; then
    # Native lighthouse (CI or local install)
    local chrome_flags="--headless --no-sandbox --disable-gpu"
    local lh_args=(
      "$url"
      --only-categories=performance
      --output=json
      "--output-path=$tmpfile"
      "--chrome-flags=$chrome_flags"
      --quiet
    )
    if [ -n "${CHROME_PATH:-}" ]; then
      lh_args+=("--chrome-path=$CHROME_PATH")
    fi
    lighthouse "${lh_args[@]}" 2>/dev/null || true

  elif command -v docker &>/dev/null; then
    # Docker fallback (local dev without lighthouse/chrome installed)
    docker run --rm \
      --platform linux/amd64 \
      -v /tmp:/tmp \
      femtopixel/google-lighthouse \
      "$url" \
        --only-categories=performance \
        --output=json \
        "--output-path=$tmpfile" \
        "--chrome-flags=--headless --no-sandbox --disable-gpu --disable-dev-shm-usage" \
        --quiet 2>/dev/null || true
  else
    echo "-1"
    return
  fi

  if [ -f "$tmpfile" ] && [ -s "$tmpfile" ]; then
    local score
    score=$(jq -r '.categories.performance.score // 0' "$tmpfile" 2>/dev/null || echo "0")
    rm -f "$tmpfile"
    awk "BEGIN {printf \"%d\", $score * 100}"
  else
    rm -f "$tmpfile"
    echo "-1"
  fi
}

# ---------------------------------------------------------------------------
# Compare and report
# ---------------------------------------------------------------------------

compare_metric() {
  local name="$1"
  local baseline="$2"
  local current="$3"
  local is_lighthouse="${4:-false}"

  if [ "$current" = "-1" ]; then
    printf "  %-22s %-12s %-12s %s\n" "$name" "$baseline" "n/a" "SKIP"
    return
  fi

  if [ "$baseline" = "0" ] || [ "$baseline" = "-1" ]; then
    printf "  %-22s %-12s %-12s %s\n" "$name" "n/a" "$current" "NEW"
    return
  fi

  local status delta_str

  if [ "$is_lighthouse" = "true" ]; then
    local diff=$((baseline - current))
    if [ "$diff" -le 5 ]; then
      status="OK"
    elif [ "$diff" -le 15 ]; then
      status="WARN"
    else
      status="REGRESSED"
    fi
    if [ "$diff" -gt 0 ]; then
      delta_str=" (-${diff}pts)"
    elif [ "$diff" -lt 0 ]; then
      delta_str=" (+$((-diff))pts)"
    else
      delta_str=""
    fi
  else
    local pct
    pct=$(awk "BEGIN {printf \"%d\", (($current - $baseline) / $baseline) * 100}")
    if [ "$pct" -le 10 ]; then
      status="OK"
    elif [ "$pct" -le 50 ]; then
      status="WARN"
    else
      status="REGRESSED"
    fi
    if [ "$pct" -gt 0 ]; then
      delta_str=" (+${pct}%)"
    elif [ "$pct" -lt 0 ]; then
      delta_str=" (${pct}%)"
    else
      delta_str=""
    fi
  fi

  printf "  %-22s %-12s %-12s %s\n" "$name" "$baseline" "$current" "${status}${delta_str}"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

echo ""
echo "=== Performance Check ==="
echo "Target: $BASE_URL"
echo ""

# Warmup
echo "Warming up..."
curl -sf -o /dev/null "$API_URL/health" 2>/dev/null || true
sleep 1

# Authenticate
echo "Authenticating..."
AUTH_RESPONSE=$(curl -sf -X POST \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${SMOKETEST_EMAIL}\",\"password\":\"${SMOKETEST_PASSWORD}\"}" \
  "$API_URL/auth/login" 2>/dev/null || echo "")

if [ -n "$AUTH_RESPONSE" ]; then
  ACCESS_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.access_token // ""' 2>/dev/null || echo "")
fi

if [ -z "$ACCESS_TOKEN" ]; then
  echo "Warning: could not authenticate, skipping authenticated endpoints"
fi

# Measure API endpoints
echo "Measuring API endpoints..."

health_ms=$(measure_endpoint "$API_URL/health")
echo "  health: ${health_ms}ms"

login_ms=$(measure_endpoint "$API_URL/auth/login" POST \
  "{\"email\":\"${SMOKETEST_EMAIL}\",\"password\":\"${SMOKETEST_PASSWORD}\"}")
echo "  login: ${login_ms}ms"

trees_ms="0"
if [ -n "$ACCESS_TOKEN" ]; then
  trees_ms=$(measure_endpoint "$API_URL/trees" GET "" true)
  echo "  trees: ${trees_ms}ms"
else
  echo "  trees: skipped (no auth)"
fi

# Measure frontend
echo "Measuring frontend..."

ttfb_ms=$(measure_ttfb "$BASE_URL/")
echo "  TTFB: ${ttfb_ms}ms"

bundle_size_kb=$(measure_bundle_size "$BASE_URL/")
echo "  Bundle size: ${bundle_size_kb}KB"

echo "Measuring Lighthouse..."
lighthouse_score=$(measure_lighthouse "$BASE_URL/")
if [ "$lighthouse_score" = "-1" ]; then
  echo "  Lighthouse: skipped (not installed)"
else
  echo "  Lighthouse: ${lighthouse_score}/100"
fi

# Write current results
jq -n \
  --argjson health "$health_ms" \
  --argjson login "$login_ms" \
  --argjson trees "$trees_ms" \
  --argjson bundle "$bundle_size_kb" \
  --argjson ttfb "$ttfb_ms" \
  --argjson lh "$lighthouse_score" \
  '{
    api: { health_ms: $health, login_ms: $login, trees_ms: $trees },
    frontend: { bundle_size_kb: $bundle, ttfb_ms: $ttfb, lighthouse_score: $lh }
  }' > "$CURRENT_FILE"

# Compare against baseline
echo ""
if [ -f "$BASELINE_FILE" ]; then
  b_health=$(jq -r '.api.health_ms // 0' "$BASELINE_FILE")
  b_login=$(jq -r '.api.login_ms // 0' "$BASELINE_FILE")
  b_trees=$(jq -r '.api.trees_ms // 0' "$BASELINE_FILE")
  b_bundle=$(jq -r '.frontend.bundle_size_kb // 0' "$BASELINE_FILE")
  b_ttfb=$(jq -r '.frontend.ttfb_ms // 0' "$BASELINE_FILE")
  b_lh=$(jq -r '.frontend.lighthouse_score // -1' "$BASELINE_FILE")

  printf "  %-22s %-12s %-12s %s\n" "Metric" "Baseline" "Current" "Status"
  printf "  %-22s %-12s %-12s %s\n" "------" "--------" "-------" "------"
  compare_metric "health_ms"        "$b_health" "$health_ms"
  compare_metric "login_ms"         "$b_login"  "$login_ms"
  compare_metric "trees_ms"         "$b_trees"  "$trees_ms"
  compare_metric "bundle_size_kb"   "$b_bundle" "$bundle_size_kb"
  compare_metric "ttfb_ms"          "$b_ttfb"   "$ttfb_ms"
  compare_metric "lighthouse_score" "$b_lh"     "$lighthouse_score" "true"
else
  echo "No baseline file found. Run 'make perf-ratchet' to create one."
  echo "Current results written to $CURRENT_FILE"
fi

echo ""
echo "=== Performance Check Complete ==="
echo ""

exit 0
