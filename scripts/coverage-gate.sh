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

BASELINE=$(jq -r ".$LANG" "$BASELINE_FILE")

if [[ "$BASELINE" == "null" ]]; then
  echo "Error: no baseline for '$LANG' in $BASELINE_FILE"
  exit 1
fi

if [[ "$LANG" == "python" ]]; then
  COVERAGE_FILE="api/coverage.json"
  if [[ ! -f "$COVERAGE_FILE" ]]; then
    echo "Error: $COVERAGE_FILE not found. Run pytest --cov --cov-report=json first."
    exit 1
  fi
  CURRENT=$(jq '.totals.percent_covered | floor' "$COVERAGE_FILE")
elif [[ "$LANG" == "typescript" ]]; then
  COVERAGE_FILE="frontend/coverage/coverage-summary.json"
  if [[ ! -f "$COVERAGE_FILE" ]]; then
    echo "Error: $COVERAGE_FILE not found. Run vitest --coverage first."
    exit 1
  fi
  CURRENT=$(jq '.total.statements.pct | floor' "$COVERAGE_FILE")
fi

echo "Coverage gate [$LANG]: current=${CURRENT}% baseline=${BASELINE}%"

if [[ "$CURRENT" -lt "$BASELINE" ]]; then
  echo "FAIL: Coverage dropped from ${BASELINE}% to ${CURRENT}%."
  exit 1
fi

DIFF=$((CURRENT - BASELINE))
if [[ "$DIFF" -gt 1 ]]; then
  echo "PASS (coverage improved by ${DIFF}%). Consider bumping baseline: make ratchet"
else
  echo "PASS"
fi
