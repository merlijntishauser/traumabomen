#!/usr/bin/env bash
#
# Privacy scanner for Traumabomen
# Checks for zero-knowledge encryption violations
#
set -euo pipefail

FRONTEND_SRC="frontend/src"
API_SRC="api/app"
ERRORS=0

red()   { printf "\033[0;31m%s\033[0m\n" "$1"; }
green() { printf "\033[0;32m%s\033[0m\n" "$1"; }
warn()  { printf "\033[0;33m%s\033[0m\n" "$1"; }

check() {
  local label="$1"
  local pattern="$2"
  local path="$3"
  local exclude="${4:-}"

  local cmd=(grep -rn --include="*.ts" --include="*.tsx" --include="*.py" -E "$pattern" "$path")
  if [[ -n "$exclude" ]]; then
    cmd+=(--exclude="$exclude")
  fi

  local matches
  matches=$("${cmd[@]}" 2>/dev/null | grep -v "privacy-ok" || true)

  if [[ -n "$matches" ]]; then
    red "FAIL: $label"
    echo "$matches" | while IFS= read -r line; do
      echo "  $line"
    done
    ERRORS=$((ERRORS + 1))
  fi
}

echo "=== Traumabomen Privacy Scanner ==="
echo ""

# ---------------------------------------------------------------------------
# 1. Plaintext data in console output
# ---------------------------------------------------------------------------
echo "Checking for plaintext data in console output..."

# console.log/debug/warn/error with suspicious variable names
check "Console output may contain decrypted data" \
  'console\.(log|debug|warn|error)\(.*\b(name|notes|description|plaintext|decrypted|person|event|title)\b' \
  "$FRONTEND_SRC" \
  "*.test.*"

# ---------------------------------------------------------------------------
# 2. Unsafe localStorage/sessionStorage usage
# ---------------------------------------------------------------------------
echo "Checking for unsafe storage usage..."

# Allowlisted localStorage keys and variable names that resolve to safe keys
ALLOWED_STORAGE="traumabomen-theme|traumabomen-canvas-settings|traumabomen-mobile-dismissed|traumabomen_access_token|traumabomen_refresh_token|mentalHealthBannerDismissed|i18nextLng|i18next|STORAGE_KEY|TOKEN_KEY|REFRESH_KEY"

# Find localStorage.setItem calls that don't use allowlisted keys
STORAGE_HITS=$(grep -rn --include="*.ts" --include="*.tsx" -E 'localStorage\.setItem\(' "$FRONTEND_SRC" 2>/dev/null | grep -v "privacy-ok" || true)
if [[ -n "$STORAGE_HITS" ]]; then
  BAD_STORAGE=$(echo "$STORAGE_HITS" | grep -v -E "($ALLOWED_STORAGE)" || true)
  if [[ -n "$BAD_STORAGE" ]]; then
    red "FAIL: localStorage.setItem with non-allowlisted key"
    echo "$BAD_STORAGE" | while IFS= read -r line; do
      echo "  $line"
    done
    ERRORS=$((ERRORS + 1))
  fi
fi

# sessionStorage should never be used for sensitive data
check "sessionStorage usage detected (use memory-only state instead)" \
  'sessionStorage\.(setItem|getItem)' \
  "$FRONTEND_SRC"

# ---------------------------------------------------------------------------
# 3. Crypto misuse
# ---------------------------------------------------------------------------
echo "Checking for crypto misuse..."

# encrypt/decrypt usage outside crypto module and contexts
CRYPTO_HITS=$(grep -rn --include="*.ts" --include="*.tsx" -E '\b(encrypt|decrypt)\(' "$FRONTEND_SRC" 2>/dev/null \
  | grep -v "privacy-ok" \
  | grep -v "crypto\.ts" \
  | grep -v "crypto\.test\.ts" \
  | grep -v "EncryptionContext" \
  | grep -v "from.*crypto" \
  | grep -v "import.*encrypt" \
  | grep -v "useEncryption" \
  | grep -v "\.d\.ts" \
  || true)

# Hardcoded IV patterns (should always use crypto.getRandomValues)
check "Potential hardcoded IV (must use crypto.getRandomValues)" \
  'new Uint8Array\(\[' \
  "$FRONTEND_SRC" \
  "*.test.*"

# ---------------------------------------------------------------------------
# 4. Sensitive data in URLs
# ---------------------------------------------------------------------------
echo "Checking for sensitive data in URLs..."

# Route definitions should only contain :id params, never person/event names
check "Route path may expose sensitive data" \
  'path=.*:(name|title|description|notes)' \
  "$FRONTEND_SRC"

# ---------------------------------------------------------------------------
# 5. Server-side: API should never decrypt or log encrypted_data
# ---------------------------------------------------------------------------
echo "Checking backend for plaintext handling..."

# API should not import or call decrypt functions
check "Backend code references decryption (server must never decrypt)" \
  '\b(decrypt|plaintext|decrypted)\b' \
  "$API_SRC"

# API should not log encrypted_data content
check "Backend may log encrypted_data content" \
  '(print|logging|logger)\(.*encrypted_data' \
  "$API_SRC"

# ---------------------------------------------------------------------------
# 6. Encryption key persistence
# ---------------------------------------------------------------------------
echo "Checking for encryption key persistence..."

# Key should never be in localStorage/sessionStorage/cookie
check "Encryption key may be persisted (must stay in memory only)" \
  '(localStorage|sessionStorage|document\.cookie).*\b(key|passphrase|secret)\b' \
  "$FRONTEND_SRC"

# ---------------------------------------------------------------------------
# Results
# ---------------------------------------------------------------------------
echo ""
if [[ "$ERRORS" -gt 0 ]]; then
  red "Privacy scan failed with $ERRORS violation(s)"
  echo "Add '// privacy-ok' comment to suppress false positives"
  exit 1
else
  green "Privacy scan passed -- no violations found"
fi
