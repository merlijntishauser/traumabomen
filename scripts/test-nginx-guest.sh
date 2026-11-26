#!/usr/bin/env bash
# Checks the guest locations of the production frontend image (nginx.conf):
# headers on /view and /view-assets/, the 404s and redirect that keep the guest
# page from being served any other way, the proxy headers the API relies on,
# the guest-links body limit, and that guest requests leave no access log line.
#
# Usage: scripts/test-nginx-guest.sh   (SKIP_BUILD=1 reuses the last image)
set -euo pipefail

cd "$(dirname "$0")/.."

IMAGE=traumabomen-frontend-guest-test
RUN_ID=$$
NET="tb-guest-test-$RUN_ID"
ECHO="tb-guest-echo-$RUN_ID"
WEB="tb-guest-web-$RUN_ID"
SECRET="nginx-test-proxy-secret"
FAILURES=0

cleanup() {
  docker rm -f "$WEB" "$ECHO" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Answers every request with the path, headers and body length it received.
ECHO_SERVER='
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

class Echo(BaseHTTPRequestHandler):
    def answer(self):
        length = int(self.headers.get("Content-Length") or 0)
        self.rfile.read(length)
        headers = {k.lower(): v for k, v in self.headers.items()}
        body = json.dumps({"path": self.path, "headers": headers, "length": length}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    do_GET = do_POST = do_PUT = do_DELETE = answer

    def log_message(self, *args):
        pass

ThreadingHTTPServer(("0.0.0.0", 8000), Echo).serve_forever()
'

pass() { echo "  ok   $1"; }
fail() { echo "  FAIL $1"; FAILURES=$((FAILURES + 1)); }

# expect_header <label> <headers file> <header name> <exact value>
# Every line of that header counts, so a duplicate with another value fails.
expect_header() {
  local actual
  actual=$(grep -i "^$3:" "$2" | cut -d: -f2- | sed 's/^ *//' | tr -d '\r' | paste -sd '|' - || true)
  if [ "$actual" = "$4" ]; then pass "$1: $3"; else fail "$1: $3 is '$actual', expected '$4'"; fi
}

# expect_status <label> <expected> <curl args...>
expect_status() {
  local label=$1 expected=$2 actual
  shift 2
  actual=$(curl -s -o /dev/null -w '%{http_code}' "$@")
  if [ "$actual" = "$expected" ]; then pass "$label: $expected"; else fail "$label: got $actual, expected $expected"; fi
}

GUEST_CSP="default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'"

if [ -z "${SKIP_BUILD:-}" ]; then
  docker build --target production -t "$IMAGE" frontend
fi

docker network create "$NET" >/dev/null
docker run -d --name "$ECHO" --network "$NET" python:3-alpine python -c "$ECHO_SERVER" >/dev/null
docker run -d --name "$WEB" --network "$NET" -p 127.0.0.1::8080 \
  -e API_URL="http://$ECHO:8000" -e PROXY_SHARED_SECRET="$SECRET" "$IMAGE" >/dev/null

PORT=$(docker port "$WEB" 8080/tcp | head -1 | sed 's/.*://')
BASE="http://127.0.0.1:$PORT"
READY=""
for _ in $(seq 1 30); do
  if curl -sf -o /dev/null "$BASE/healthz" && docker exec "$ECHO" python -c \
      'import urllib.request; urllib.request.urlopen("http://127.0.0.1:8000/")' 2>/dev/null; then
    READY=1
    break
  fi
  sleep 1
done
if [ -z "$READY" ]; then
  echo "test-nginx-guest: nginx or the echo server did not come up within 30 s"
  docker logs "$WEB" 2>&1 | tail -20
  exit 1
fi

TMP=$(mktemp -d)
trap 'cleanup; rm -rf "$TMP"' EXIT

echo "/view"
curl -s -D "$TMP/view.h" -o "$TMP/view.html" -A guest-probe-view "$BASE/view"
if head -1 "$TMP/view.h" | grep -q " 200"; then pass "/view: 200"; else fail "/view: $(head -1 "$TMP/view.h")"; fi
expect_header "/view" "$TMP/view.h" "Content-Security-Policy" "$GUEST_CSP"
expect_header "/view" "$TMP/view.h" "Cache-Control" "no-store"
expect_header "/view" "$TMP/view.h" "Referrer-Policy" "no-referrer"
expect_header "/view" "$TMP/view.h" "X-Robots-Tag" "noindex"
expect_header "/view" "$TMP/view.h" "X-Frame-Options" "DENY"
expect_header "/view" "$TMP/view.h" "X-Content-Type-Options" "nosniff"
expect_header "/view" "$TMP/view.h" "Cross-Origin-Opener-Policy" "same-origin"
if grep -qi "googleapis\|gstatic\|sentry" "$TMP/view.html"; then fail "/view: page names a third-party host"; else pass "/view: no third-party host in the page"; fi

echo "/view-assets/"
ASSETS=$(grep -o '/view-assets/[^"]*' "$TMP/view.html" | sort -u || true)
if [ -z "$ASSETS" ]; then fail "/view: references no /view-assets/ files"; fi
if echo "$ASSETS" | grep -q "argon2"; then pass "/view: loads argon2 from /view-assets/"; else fail "/view: no argon2 script under /view-assets/"; fi
for asset in $ASSETS; do
  expect_status "$asset" 200 -A guest-probe-assets "$BASE$asset"
done
FIRST_ASSET=$(echo "$ASSETS" | head -1)
curl -s -D "$TMP/asset.h" -o /dev/null -A guest-probe-assets "$BASE$FIRST_ASSET"
if grep -qi '^Cache-Control: public, immutable' "$TMP/asset.h" && ! grep -qi '^Cache-Control:.*no-' "$TMP/asset.h"; then
  pass "$FIRST_ASSET: immutable caching"
else
  fail "$FIRST_ASSET: Cache-Control is $(grep -i '^Cache-Control' "$TMP/asset.h" | tr -d '\r' | paste -sd '|' -)"
fi
expect_header "$FIRST_ASSET" "$TMP/asset.h" "Content-Security-Policy" "$GUEST_CSP"
expect_header "$FIRST_ASSET" "$TMP/asset.h" "Referrer-Policy" "no-referrer"
expect_header "$FIRST_ASSET" "$TMP/asset.h" "X-Robots-Tag" "noindex"
expect_status "/view-assets/x" 404 -A guest-probe-assets "$BASE/view-assets/x"

echo "other spellings"
expect_status "/view.html" 404 "$BASE/view.html"
expect_status "/view-assets/view.html" 404 "$BASE/view-assets/view.html"
curl -s -D "$TMP/slash.h" -o /dev/null -A guest-probe-slash "$BASE/view/"
if head -1 "$TMP/slash.h" | grep -q " 301"; then pass "/view/: 301"; else fail "/view/: $(head -1 "$TMP/slash.h")"; fi
expect_header "/view/" "$TMP/slash.h" "Location" "/view"

echo "/api/guest/open"
curl -s -o "$TMP/open.json" -A guest-probe-open -X POST \
  -H "X-Real-IP: 203.0.113.66" -H "X-Proxy-Secret: forged-secret" \
  -H "Content-Type: application/json" -d '{"link_id":"a","token":"b"}' "$BASE/api/guest/open"
if grep -q '"path": "/guest/open"' "$TMP/open.json"; then pass "/api/guest/open: proxied to /guest/open"; else fail "/api/guest/open: upstream saw $(cat "$TMP/open.json")"; fi
if grep -q '"x-proxy-secret": "'"$SECRET"'"' "$TMP/open.json"; then pass "/api/guest/open: forged X-Proxy-Secret replaced"; else fail "/api/guest/open: X-Proxy-Secret not replaced"; fi
if grep -q '"x-real-ip": "[0-9a-f.:]*"' "$TMP/open.json" && ! grep -q '203.0.113.66' "$TMP/open.json"; then
  pass "/api/guest/open: forged X-Real-IP replaced"
else
  fail "/api/guest/open: X-Real-IP not replaced"
fi
CLIENT_IP=$(grep -o '"x-real-ip": "[^"]*"' "$TMP/open.json" | cut -d'"' -f4 || true)
curl -s -o "$TMP/open-slash.json" -A guest-probe-open-slash -X POST \
  -H "Content-Type: application/json" -d '{"link_id":"a","token":"b"}' "$BASE/api/guest/open/"
if grep -q '"path": "/guest/open"' "$TMP/open-slash.json"; then pass "/api/guest/open/: proxied to /guest/open"; else fail "/api/guest/open/: upstream saw $(cat "$TMP/open-slash.json")"; fi
for header in x-forwarded-for x-forwarded-proto host; do
  if grep -q "\"$header\": " "$TMP/open.json"; then pass "/api/guest/open: sends $header"; else fail "/api/guest/open: no $header upstream"; fi
done

echo "/api/trees/{id}/guest-links"
head -c 2000000 /dev/zero | tr '\0' 'a' > "$TMP/big.json"
curl -s -o "$TMP/links.json" -X POST -H "X-Real-IP: 203.0.113.66" -H "X-Proxy-Secret: forged-secret" \
  --data-binary @"$TMP/big.json" "$BASE/api/trees/abc/guest-links"
if grep -q '"path": "/trees/abc/guest-links"' "$TMP/links.json" && grep -q '"length": 2000000' "$TMP/links.json"; then
  pass "guest-links: 2 MB body proxied to /trees/abc/guest-links"
else
  fail "guest-links: upstream saw $(head -c 300 "$TMP/links.json")"
fi
if grep -q '"x-proxy-secret": "'"$SECRET"'"' "$TMP/links.json" && ! grep -q '203.0.113.66' "$TMP/links.json"; then
  pass "guest-links: forged headers replaced"
else
  fail "guest-links: forged headers not replaced"
fi
expect_status "guest-links/{id}: 2 MB body proxied" 200 -X PUT --data-binary @"$TMP/big.json" "$BASE/api/trees/abc/guest-links/xyz"
expect_status "other API paths keep the 1 MB limit" 413 -X POST --data-binary @"$TMP/big.json" "$BASE/api/trees/abc/persons"

echo "error log"
# Both of these write an error-level line with the client address unless the
# guest location raises its error_log threshold.
docker stop "$ECHO" >/dev/null
# 502 or 504 depending on how the connect fails; either is an upstream error.
DOWN=$(curl -s -o /dev/null -w '%{http_code}' -A guest-probe-open -X POST -d '{}' "$BASE/api/guest/open")
case "$DOWN" in
  502|504) pass "/api/guest/open with the API down: $DOWN" ;;
  *) fail "/api/guest/open with the API down: got $DOWN, expected 502 or 504" ;;
esac
# In parallel: with the API down each request that gets through waits for its
# connect to fail, so sequential requests would trickle under the limit.
for i in $(seq 1 10); do
  curl -s -o /dev/null -w '%{http_code}' -A guest-probe-open -X POST -d '{}' "$BASE/api/guest/open" > "$TMP/burst.$i" &
done
wait
LIMITED=$(cat "$TMP"/burst.* | grep -o 429 | wc -l | tr -d ' ')
if [ "$LIMITED" -gt 0 ]; then pass "/api/guest/open: limit_req rejected $LIMITED request(s)"; else fail "/api/guest/open: limit_req never rejected"; fi
sleep 1
docker logs "$WEB" > "$TMP/nginx-errors.log" 2>&1
if [ -z "$CLIENT_IP" ]; then
  fail "client address unknown (upstream did not report X-Real-IP)"
elif grep -F "$CLIENT_IP" "$TMP/nginx-errors.log" | grep -q 'guest/open\|/view'; then
  fail "a guest request left a log line with the client address:"
  grep -F "$CLIENT_IP" "$TMP/nginx-errors.log" | grep 'guest/open\|/view' | head -5 || true
else
  pass "rate-limited and failed guest opens left no line with the client address"
fi
if grep -q 'guest/open' "$TMP/nginx-errors.log"; then fail "a guest open left a log line"; else pass "no log line names guest/open"; fi

echo "access log"
curl -s -o /dev/null -A guest-probe-root "$BASE/"
sleep 1
docker logs "$WEB" > "$TMP/nginx.log" 2>&1
if grep -q "guest-probe-root" "$TMP/nginx.log"; then pass "/ is logged"; else fail "/ left no access log line (check is not meaningful)"; fi
for probe in guest-probe-view guest-probe-assets guest-probe-slash guest-probe-open guest-probe-open-slash; do
  if grep -q "$probe" "$TMP/nginx.log"; then fail "$probe left an access log line"; else pass "$probe left no access log line"; fi
done
if grep -q "view-assets/x" "$TMP/nginx.log"; then fail "a missing /view-assets/ file was logged"; else pass "a missing /view-assets/ file left no log line"; fi

echo
if [ "$FAILURES" -gt 0 ]; then
  echo "test-nginx-guest: $FAILURES check(s) failed"
  exit 1
fi
echo "test-nginx-guest: all checks passed"
