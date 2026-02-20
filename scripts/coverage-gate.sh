#!/usr/bin/env bash
#
# Coverage ratchet gate. Compares measured coverage against the baseline
# in .coverage-baseline.json and fails if coverage has decreased.
#
# Usage:
#   scripts/coverage-gate.sh python   # reads api/coverage.json
#   scripts/coverage-gate.sh typescript  # reads frontend/coverage/coverage-summary.json
#
set -euo pipefail

BASELINE_FILE=".coverage-baseline.json"

if [[ $# -ne 1 ]] || [[ "$1" != "python" && "$1" != "typescript" ]]; then
  echo "Usage: $0 <python|typescript>"
  exit 1
fi

LANG="$1"

if ! command -v jq &>/dev/null; then
  echo "Error: jq is required but not installed."
  exit 1
fi

if [[ ! -f "$BASELINE_FILE" ]]; then
  echo "Error: $BASELINE_FILE not found."
  exit 1
fi

check_gate() {
  local label="$1" current="$2" baseline="$3"

  echo "Coverage gate [$label]: current=${current}% baseline=${baseline}%"

  if [[ "$current" -lt "$baseline" ]]; then
    echo "FAIL: Coverage dropped from ${baseline}% to ${current}%."
    return 1
  fi

  local diff=$((current - baseline))
  if [[ "$diff" -gt 1 ]]; then
    echo "PASS (coverage improved by ${diff}%). Consider bumping baseline: make ratchet"
  else
    echo "PASS"
  fi
}

FAILED=0

if [[ "$LANG" == "python" ]]; then
  COVERAGE_FILE="api/coverage.json"
  if [[ ! -f "$COVERAGE_FILE" ]]; then
    echo "Error: $COVERAGE_FILE not found. Run pytest --cov --cov-report=json first."
    exit 1
  fi
  BASELINE=$(jq -r ".python" "$BASELINE_FILE")
  CURRENT=$(jq '.totals.percent_covered | floor' "$COVERAGE_FILE")
  check_gate "python" "$CURRENT" "$BASELINE" || FAILED=1

elif [[ "$LANG" == "typescript" ]]; then
  COVERAGE_FILE="frontend/coverage/coverage-summary.json"
  if [[ ! -f "$COVERAGE_FILE" ]]; then
    echo "Error: $COVERAGE_FILE not found. Run vitest --coverage first."
    exit 1
  fi

  STMT_BASELINE=$(jq -r ".typescript_statements" "$BASELINE_FILE")
  STMT_CURRENT=$(jq '.total.statements.pct | floor' "$COVERAGE_FILE")
  check_gate "typescript/statements" "$STMT_CURRENT" "$STMT_BASELINE" || FAILED=1

  LINE_BASELINE=$(jq -r ".typescript_lines" "$BASELINE_FILE")
  LINE_CURRENT=$(jq '.total.lines.pct | floor' "$COVERAGE_FILE")
  check_gate "typescript/lines" "$LINE_CURRENT" "$LINE_BASELINE" || FAILED=1
fi

exit "$FAILED"
