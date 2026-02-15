#!/usr/bin/env bash
#
# Code complexity and maintainability report.
# Runs radon (Python CC + MI) and ESLint sonarjs (TypeScript cognitive complexity).
#
# Usage:
#   scripts/complexity-report.sh          # run both
#   scripts/complexity-report.sh python   # python only
#   scripts/complexity-report.sh typescript  # typescript only
#
set -euo pipefail

BOLD="\033[1m"
DIM="\033[2m"
CYAN="\033[36m"
YELLOW="\033[33m"
GREEN="\033[32m"
RED="\033[31m"
RESET="\033[0m"

TARGET="${1:-all}"

header() {
  echo ""
  echo -e "${BOLD}${CYAN}--- $1 ---${RESET}"
  echo ""
}

run_python() {
  header "Python -- Cyclomatic Complexity (radon cc)"
  echo -e "${DIM}Functions rated B or higher (A = simple, F = very complex):${RESET}"
  echo ""

  CC_OUTPUT=$(docker compose exec -T api uv run radon cc app/ -s -a -n B 2>&1)
  BLOCK_LINE=$(echo "$CC_OUTPUT" | grep "blocks.*analyzed" || true)
  BLOCK_COUNT=$(echo "$BLOCK_LINE" | awk '{print $1}')

  if [[ -z "$BLOCK_COUNT" || "$BLOCK_COUNT" == "0" ]]; then
    echo -e "  ${GREEN}All functions rated A (simple)${RESET}"
  else
    echo "$CC_OUTPUT" | while IFS= read -r line; do
      case "$line" in
        *"- F "* | *"- E "* | *"- D "*)
          echo -e "  ${RED}${line}${RESET}" ;;
        *"- C "*)
          echo -e "  ${YELLOW}${line}${RESET}" ;;
        *"- B "*)
          echo -e "  ${DIM}${line}${RESET}" ;;
        *".py"*)
          echo -e "  ${CYAN}${line}${RESET}" ;;
        *"Average"*)
          echo ""
          echo -e "  ${BOLD}${line}${RESET}" ;;
        *"blocks"*"analyzed"*)
          echo -e "  ${DIM}${line}${RESET}" ;;
        *)
          [[ -n "$line" ]] && echo "  $line" ;;
      esac
    done
  fi

  header "Python -- Maintainability Index (radon mi)"
  echo -e "${DIM}Scores: A (high, 20-100) > B (medium, 10-19) > C (low, 0-9)${RESET}"
  echo ""

  MI_OUTPUT=$(docker compose exec -T api uv run radon mi app/ -s 2>&1)

  echo "$MI_OUTPUT" | while IFS= read -r line; do
    case "$line" in
      *"- C "*)
        echo -e "  ${RED}${line}${RESET}" ;;
      *"- B "*)
        echo -e "  ${YELLOW}${line}${RESET}" ;;
      *"- A "*)
        # Color by MI value: green >= 50, yellow < 50
        MI_VAL=$(echo "$line" | sed -n 's/.*(\([0-9]*\)\..*/\1/p')
        if [[ -n "$MI_VAL" ]] && [[ "$MI_VAL" -lt 50 ]]; then
          echo -e "  ${YELLOW}${line}${RESET}"
        else
          echo -e "  ${GREEN}${line}${RESET}"
        fi
        ;;
      *)
        [[ -n "$line" ]] && echo "  $line" ;;
    esac
  done

  # Summary
  TOTAL=$(echo "$MI_OUTPUT" | { grep -c '\.py' || true; })
  BELOW_A=$(echo "$MI_OUTPUT" | { grep -c -- '- [BC] ' || true; })
  echo ""
  echo -e "  ${BOLD}${TOTAL} modules, ${BELOW_A} rated below A${RESET}"
}

run_typescript() {
  header "TypeScript -- Cognitive Complexity (eslint-plugin-sonarjs)"
  echo -e "${DIM}Functions exceeding cognitive complexity threshold of 15:${RESET}"
  echo ""

  # Override per-file exemptions so the report shows ALL hotspots
  ESLINT_OUTPUT=$(docker compose exec -T frontend npx eslint src/ \
    --rule '{"sonarjs/cognitive-complexity": ["warn", 15]}' \
    --format stylish 2>&1 || true)

  HAS_COMPLEXITY=$(echo "$ESLINT_OUTPUT" | { grep -c "cognitive-complexity" || true; })

  if [[ "$HAS_COMPLEXITY" == "0" ]]; then
    echo -e "  ${GREEN}All functions within threshold${RESET}"
  else
    CURRENT_FILE=""
    echo "$ESLINT_OUTPUT" | while IFS= read -r line; do
      # File path lines start with /
      case "$line" in
        /*)
          CURRENT_FILE="$line"
          ;;
        *cognitive-complexity*)
          if [[ -n "$CURRENT_FILE" ]]; then
            DISPLAY_FILE=$(echo "$CURRENT_FILE" | sed 's|^/app/||')
            echo -e "  ${CYAN}${DISPLAY_FILE}${RESET}"
            CURRENT_FILE=""
          fi
          # Extract complexity value from "from NN to"
          COMPLEXITY=$(echo "$line" | sed -n 's/.*from \([0-9]*\) to.*/\1/p')
          if [[ -n "$COMPLEXITY" ]] && [[ "$COMPLEXITY" -ge 30 ]]; then
            echo -e "    ${RED}${line}${RESET}"
          else
            echo -e "    ${YELLOW}${line}${RESET}"
          fi
          ;;
      esac
    done

    echo ""
    echo -e "  ${BOLD}${HAS_COMPLEXITY} functions exceed threshold${RESET}"
  fi
}

case "$TARGET" in
  python)     run_python ;;
  typescript) run_typescript ;;
  all)        run_python; run_typescript ;;
  *)
    echo "Usage: $0 [python|typescript|all]"
    exit 1
    ;;
esac

echo ""
echo -e "${BOLD}${GREEN}Report complete.${RESET}"
