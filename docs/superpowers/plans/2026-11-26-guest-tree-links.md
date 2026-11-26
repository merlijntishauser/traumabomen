# Guest tree links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a tree owner publish an encrypted, read-only copy of one tree that someone without an account opens with a link plus a generated passphrase, with expiry, an off switch and usage figures.

**Architecture:** The owner's browser derives a link id, an encryption key and an auth token from a random link secret (URL fragment) and an Argon2id-stretched passphrase, encrypts one JSON copy of the tree, and stores it on the API. A guest posts the link id and token to `POST /guest/open` and decrypts the copy on a separate, minimal page at `/view` that has no Sentry, no third-party requests and no storage. nginx passes a verified client address so the API can count networks as keyed hashes.

**Tech Stack:** FastAPI, SQLAlchemy async, Alembic, PostgreSQL; Vite 8, React 19, TypeScript 7, Web Crypto, argon2-browser; nginx; Vitest, pytest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-25-guest-tree-links-design.md` (approved 2026-11-26). Read it before your task: it is the authority, this plan argues from it.

## Global Constraints

- Derivation (both sides, byte-exact): `linkId = HKDF-SHA256(linkSecret, info "traumabomen/guest/v1/id", 16)`, `salt = HKDF(linkSecret, "traumabomen/guest/v1/salt", 16)`, `pass = Argon2id(passphrase, salt; t=3, m=65536 KiB, p=1, 32 bytes)`, `root = linkSecret || pass`, `encKey = HKDF(root, "traumabomen/guest/v1/enc", 32)`, `token = HKDF(root, "traumabomen/guest/v1/auth", 32)`. HKDF salt is empty. `linkSecret` is 32 random bytes. All binary values travel as unpadded base64url.
- Copy encryption: AES-256-GCM, fresh 12-byte IV per publish, AAD `"traumabomen/guest/v1/" + base64url(linkId)`. `encKey` is non-extractable.
- Passphrase: five words, `crypto.getRandomValues` with rejection sampling, 7776-word list. Normalise: NFKC, lowercase, runs of hyphens/whitespace to one space, trim.
- Link URL: `{origin}/view#{linkSecret}`. Nothing else in the URL.
- Server stores `SHA-256(token)`, compares in constant time.
- Expiry choices 1, 7, 14, 30 days, 7 preselected. Extending sets `now + days` with the same choices (30 caps each extension, not total life).
- Caps: 5 live links per tree; lock at `failed_streak >= 10`; 100 network rows per link ("100 or more"); 5 MB ciphertext.
- `POST /guest/open` outcomes: 404 `not_available` (unknown, expired, ended, owner lacks flag: identical bodies), 423 `locked` (checked before the token), 401 `wrong_passphrase`, 200 with ciphertext. Whole check under `SELECT ... FOR UPDATE`.
- Flag `guest_links`, seeded `disabled`. Required (for the link owner, at that moment) by open, create, republish, extend, unlock. List and end always work.
- Guest and guest-link responses: `Cache-Control: no-store`.
- Never in the copy: journal entries, tree key, master key. Explicit field projection per entity. Abort the publish on any fetch or decrypt failure.
- Guest page: no Sentry, no Google Fonts, no request to any host but self, nothing written to localStorage/sessionStorage/IndexedDB/cookies, fragment removed with `history.replaceState` right after reading, secrets and data dropped on `pagehide` and after 15 idle minutes.
- No guest address in any app log, nginx access log, or Sentry event.
- Copy rules (AGENTS.md): EN and NL in lockstep, sentence case, no `--` or `—`, no exclamation marks, no emoji; refer to the guest as "they".
- Project gates: `npx tsc -b` (not `--noEmit`), `make quality`, React Doctor 100 (`npx react-doctor@0.4.0`), `bash scripts/privacy-scan.sh`, bandit. Trunk-based: commit to main, no PRs, no AI attribution, never bypass 1Password signing (on "failed to fill whole buffer" stop and report).
- Frontend test naming: `*.unit.test.ts` for logic without DOM, `*.test.tsx` for rendering. Backend: `tests/unit/` without DB, `tests/integration/` with it.

## Review Focus

1. **A passphrase typed differently** (capitals, double spaces, hyphens between words, a trailing space, pasted with a newline) must still open. Pinned in Task 7.
2. **A link mangled by a mail client** (trailing `.`, `)` or whitespace after the fragment; a truncated fragment) must give the "malformed link" state, never a wrong-passphrase count. Pinned in Task 12.
3. **The owner edits the tree after publishing**: the guest keeps seeing the published copy until "Update what they see", and republishing keeps the usage counts. Pinned in Tasks 4 and 13.
4. **The tree or the owner's account is deleted while links exist**: rows cascade and the guest gets `not_available`. Pinned in Task 4.
5. **A tree too large to publish**: the owner sees a plain "too large" message (API 413 or the client-side 5 MB check), never a half-published link. Pinned in Tasks 4 and 13.

---

### Task 1: Verified client address

**Files:**
- Modify: `api/app/config.py`, `api/app/rate_limiter.py`, `frontend/nginx.conf`, `frontend/Dockerfile`, `.env.example`, `docker-compose.yml` (only if env is listed there)
- Test: `api/tests/unit/test_client_ip.py`

**Interfaces:**
- Produces: `ClientAddress = NamedTuple("ClientAddress", [("ip", str), ("verified", bool)])` and `get_client_address(request: Request) -> ClientAddress` in `app/rate_limiter.py`; `get_client_ip(request) -> str` keeps its signature. Settings `PROXY_SHARED_SECRET: str = ""` and `PROXY_SHARED_SECRET_PREVIOUS: str = ""`. Header names `X-Real-IP` and `X-Proxy-Secret` (constant `PROXY_SECRET_HEADER = "x-proxy-secret"`, exported for Task 6).

- [ ] **Step 1: Write failing unit tests** in `test_client_ip.py`: verified when `x-proxy-secret` equals the current secret, also when it equals the previous one; `ip` is then `x-real-ip`. Unverified (falls back to today's left-most XFF / peer behaviour, exactly as the existing tests expect) when: the header is missing, wrong, or empty; the configured secret is empty (an empty header must never match an empty secret); `x-real-ip` is not a valid IP (use `ipaddress.ip_address`). A right-most XFF entry is never used. An unverified request with `TRUST_PROXY_HEADERS` on logs one warning that contains no address (assert with `caplog`).
- [ ] **Step 2: Run** `docker compose exec api uv run pytest tests/unit/test_client_ip.py -v` and see the new tests fail.
- [ ] **Step 3: Implement** `get_client_address` with `hmac.compare_digest` against each non-empty configured secret; `get_client_ip` returns `get_client_address(request).ip`. Rate-limit warning throttled to once per minute per process.
- [ ] **Step 4: nginx.** In all four `proxy_pass` locations add `proxy_set_header X-Real-IP $remote_addr;` (already present; keep) and `proxy_set_header X-Proxy-Secret "${PROXY_SHARED_SECRET}";`. In the Dockerfile production stage set `ENV NGINX_ENVSUBST_FILTER=API_URL|PROXY_SHARED_SECRET` and `ENV PROXY_SHARED_SECRET=""` so an unset secret renders as an empty header (nginx then omits it) rather than an unknown variable. Add the variable to `.env.example`.
- [ ] **Step 5: Run** the unit tests, `docker compose exec api uv run mypy app/`, and `docker build --target production -t tb-fe-test ./frontend && docker run --rm -e API_URL=http://localhost:1 tb-fe-test nginx -t` (expect "syntax is ok"; it must also pass with `-e PROXY_SHARED_SECRET=abc`).
- [ ] **Step 6: Commit** `fix(api): trust the client address only with the proxy secret`.

Do not edit `.github/workflows/deploy.yml`: the production secret does not exist yet (see Release steps).

### Task 2: Models, migration and flag

**Files:**
- Create: `api/app/models/guest_link.py`, `api/alembic/versions/<rev>_add_guest_links.py`
- Modify: `api/app/models/__init__.py`, `api/app/models/tree.py` (relationship, cascade)
- Test: `api/tests/integration/test_guest_links_model.py`

**Interfaces:**
- Produces: `GuestLink` (table `guest_links`: `id` UUID pk; `tree_id`, `owner_id` FK cascade, indexed; `link_id: String(22)` unique; `token_hash: String(64)` hex; `ciphertext: Text` with `deferred()`; `owner_blob: Text`; `created_at`, `published_at`, `expires_at` tz-aware; `failed_streak`, `failed_total`, `open_count: int = 0`; `last_opened_at` nullable). `GuestLinkNetwork` (table `guest_link_networks`: `guest_link_id` FK cascade, `network_hash: String(64)`, composite pk/unique). Constants `MAX_LIVE_LINKS_PER_TREE = 5`, `LOCK_THRESHOLD = 10`, `MAX_NETWORKS = 100`, `EXPIRY_DAY_CHOICES = (1, 7, 14, 30)`, `MAX_CIPHERTEXT_CHARS = 7_000_000` (base64 of 5 MB plus JSON framing), `MAX_OWNER_BLOB_CHARS = 4096`.

- [ ] **Step 1: Failing tests:** deleting the tree, and deleting the owner, removes the link and its network rows; a duplicate `link_id` raises `IntegrityError`; a duplicate `(guest_link_id, network_hash)` raises.
- [ ] **Step 2: Run** them, see them fail.
- [ ] **Step 3: Implement** the models and an Alembic migration (hand-written, following `b7d2c4e8f1a3_add_tree_sharing.py`) that creates both tables and seeds `INSERT INTO feature_flags (key, audience) VALUES ('guest_links', 'disabled')`; downgrade drops the flag users, the flag and the tables.
- [ ] **Step 4: Run** the tests, then `docker compose exec api uv run alembic upgrade head` and `alembic downgrade -1 && alembic upgrade head`.
- [ ] **Step 5: Commit** `feat(api): guest link tables and flag`.

### Task 3: Network hashing and sweep helpers

**Files:**
- Create: `api/app/guest_links.py`
- Test: `api/tests/unit/test_guest_network.py`, `api/tests/integration/test_guest_sweep.py`

**Interfaces:**
- Produces: `network_of(ip: str) -> str` (IPv4 as is; IPv6 to its /64 as `"<prefix>/64"`; IPv4-mapped IPv6 as the IPv4); `network_hash(link_id: str, ip: str) -> str` = hex HMAC-SHA256 under `subkey = HMAC-SHA256(JWT_SECRET_KEY, b"traumabomen/guest-network/v1")` over `link_id + "|" + network_of(ip)`; `hash_token(token: str) -> str` (hex SHA-256 of the decoded token bytes); `async sweep_expired_guest_links(db) -> int` (deletes rows with `expires_at <= now`, returns count, does not commit).

- [ ] **Step 1: Failing unit tests:** same IPv4 gives the same hash; different IPv4s differ; two addresses in one IPv6 /64 match, across /64s differ; the same address under two link ids differs; the hash does not contain the address and changes with `JWT_SECRET_KEY` (patch settings). Integration: sweep removes an expired link with its networks and leaves a live one.
- [ ] **Step 2: Run, see fail. Step 3: Implement. Step 4: Run, see pass.**
- [ ] **Step 5: Commit** `feat(api): guest network hashing and expiry sweep`.

### Task 4: Owner endpoints

**Files:**
- Create: `api/app/routers/guest_links.py`, `api/app/schemas/guest_links.py`
- Modify: `api/app/main.py` (include router), `api/tests/integration/conftest.py` (fixture `guest_links_enabled`, modelled on `sharing_enabled`)
- Test: `api/tests/integration/test_guest_links.py`

**Interfaces:**
- Consumes: Task 2 models and constants, Task 3 helpers, `get_owned_tree`, `user_has_flag`.
- Produces (all under `/trees/{tree_id}/guest-links`, owner only via `get_owned_tree`, all with `Cache-Control: no-store`):
  - `GET` -> `list[GuestLinkOut]`; runs the sweep first. `GuestLinkOut = {id, owner_blob, created_at, published_at, expires_at, open_count, last_opened_at, network_count: int | None, failed_total, locked: bool}`; `network_count` is `None` when `PROXY_SHARED_SECRET` is empty, else `min(rows, 100)`. Never ciphertext or token hash.
  - `POST` `{link_id, token, ciphertext, owner_blob, expires_in_days}` -> 201 `GuestLinkOut`. 403 `guest_links_not_enabled` without the flag; 409 `too_many_links` at 5 live links (count under `SELECT ... FOR UPDATE` on the tree row); 413 `copy_too_large` above `MAX_CIPHERTEXT_CHARS`; 422 for `link_id` not matching `^[A-Za-z0-9_-]{22}$`, `token` not matching `^[A-Za-z0-9_-]{43}$`, days not in the choices, owner_blob too long.
  - `PUT /{id}/copy` `{ciphertext}` -> sets ciphertext and `published_at`, keeps counts. Flag required, 413 as above.
  - `PUT /{id}/expiry` `{days}` -> `expires_at = now + days`. Flag required.
  - `POST /{id}/unlock` -> `failed_streak = 0`. Flag required.
  - `DELETE /{id}` -> 204. No flag needed.
  - 404 `Guest link not found` for a link of another tree, an expired link, or another owner's tree.
- Rate-limit create with `check_endpoint_rate_limit(ip, "guest-link-create")`.

- [ ] **Step 1: Failing tests:** each endpoint's success path; flag-off refusals for create/copy/expiry/unlock while list and delete still work; owner isolation (another user, and an account-share recipient of the tree from `test_shared_read_access.py` patterns, both 404 on every endpoint); the sixth live link is 409 and an expired one does not count; 413; validation 422s; list never contains `ciphertext` or `token_hash` keys; republish keeps `open_count` (Review Focus 3); `network_count` is `None` without a proxy secret; deleting the tree removes links (Review Focus 4); `no-store` header present.
- [ ] **Step 2: Run, see fail. Step 3: Implement. Step 4: Run, see pass; mypy.**
- [ ] **Step 5: Commit** `feat(api): owner endpoints for guest links`.

### Task 5: Guest open endpoint

**Files:**
- Create: `api/app/routers/guest.py`
- Modify: `api/app/main.py`, `api/app/routers/auth.py` (call the sweep on successful login)
- Test: `api/tests/integration/test_guest_open.py`

**Interfaces:**
- Produces: `POST /guest/open` body `{link_id, token}` (same regexes as Task 4; a malformed body is 422) -> 200 `{ciphertext}`, `Cache-Control: no-store` on every response.

Order inside one transaction: rate limit (`check_endpoint_rate_limit(ip, "guest-open")`); sweep; `select(GuestLink).where(link_id=...).with_for_update()` without ciphertext; missing, `expires_at <= now`, or owner lacks `guest_links` -> 404 `not_available`; `failed_streak >= 10` -> 423 `locked`; token hash mismatch (`hmac.compare_digest`) -> both counters + 1, commit, 401 `wrong_passphrase`; else `failed_streak = 0`, `open_count + 1`, `last_opened_at = now`, and when `get_client_address` is verified and fewer than 100 rows exist, insert the network hash if absent (`on conflict do nothing` semantics; works on SQLite and Postgres); commit; then load ciphertext.

- [ ] **Step 1: Failing tests:** 200 returns the ciphertext and bumps counts; unknown, expired (with the sweep patched out so the row still exists) and flag-off give byte-identical 404 bodies; 10 wrong tokens then the right one gives 423; a wrong token after unlock counts from zero; same verified address twice gives one network, two addresses two; IPv6 /64 counted once; unverified requests (forged `X-Real-IP` without the secret, or with a wrong secret) add no network; the 101st network is not stored; no column anywhere holds the raw address (scan the rows); login runs the sweep. Postgres only (`pytest.mark.skipif` on SQLite): 20 concurrent wrong guesses via `asyncio.gather` with separate sessions: exactly 10 get 401, the other 10 get 423, and `failed_streak` and `failed_total` end at 10.
- [ ] **Step 2: Run, see fail. Step 3: Implement. Step 4: Run** on SQLite and on Postgres (`TEST_DATABASE_URL`, see AGENTS.md "Test Directory Convention").
- [ ] **Step 5: Commit** `feat(api): guest open endpoint`.

### Task 6: No guest trace in API logs or Sentry

**Files:**
- Modify: `api/app/main.py`
- Test: `api/tests/unit/test_main_helpers.py`, `api/tests/unit/test_sentry.py`

**Interfaces:**
- Consumes: `PROXY_SECRET_HEADER` from Task 1.
- Produces: a uvicorn access-log filter that drops records whose path starts with `/guest/` (extend `_HealthCheckLogFilter` into one filter with a tuple of dropped prefixes); Sentry `before_send` and `before_send_transaction` that always delete the `x-proxy-secret` header (any case), and for requests whose URL path starts with `/guest/` delete all request headers, `env`, `user` and `client` IP fields.

- [ ] **Step 1: Failing tests** for each of those behaviours, including that the existing `encrypted_data` stripping still works.
- [ ] **Step 2-4: Run, implement, run.**
- [ ] **Step 5: Commit** `fix(api): keep guest requests and the proxy secret out of logs and Sentry`.

### Task 7: Guest cryptography

**Files:**
- Create: `frontend/src/lib/guestCrypto.ts`, `frontend/src/lib/guestCrypto.unit.test.ts`, `frontend/src/lib/passphraseWords.ts`, word lists under `frontend/src/lib/wordlists/`, `frontend/THIRD_PARTY_NOTICES.md` (or append if one exists)

**Interfaces:**
- Produces (`guestCrypto.ts` must import nothing but `./argon2`; no `lib/api`, no Sentry):
  - `toBase64Url(b: Uint8Array): string`, `fromBase64Url(s: string): Uint8Array` (throws `GuestLinkFormatError` on bad input)
  - `generateLinkSecret(): string` (43 chars)
  - `parseLinkSecret(fragment: string): string`: strips a leading `#` and trailing whitespace and `.,;:)]>'"`, then requires exactly 43 base64url chars decoding to 32 bytes, else throws `GuestLinkFormatError`
  - `normalizePassphrase(input: string): string`
  - `deriveGuestKeys(linkSecret: string, passphrase: string): Promise<{ linkId: string; token: string; encKey: CryptoKey }>` (normalises first)
  - `deriveLinkId(linkSecret: string): Promise<string>`
  - `encryptGuestCopy(json: string, encKey: CryptoKey, linkId: string): Promise<string>` -> `JSON.stringify({iv, ciphertext})` base64 like `encryptForApi`
  - `decryptGuestCopy(blob: string, encKey: CryptoKey, linkId: string): Promise<string>` (throws `DecryptError` from `crypto.ts`, moved or re-declared without importing `crypto.ts` if that pulls more in; your call)
  - `passphraseWords.ts`: `generatePassphrase(language: "en" | "nl"): Promise<string>` (lazy-imports the list; five words joined by one space)

- [ ] **Step 1: Word lists.** EN: the EFF large wordlist (CC BY 3.0). NL: a 7776-word Dutch diceware list whose licence permits bundling. Keep only lowercase ASCII words without spaces or hyphens, exactly 7776, unique. Record source, URL and licence in `THIRD_PARTY_NOTICES.md`. Ruling if no Dutch list with a clear licence exists: use the EN list for both languages, note it in the notices file and in your report.
- [ ] **Step 2: Failing tests.** Fixed vectors: compute them independently in the api container with Python (`cryptography` HKDF and `argon2-cffi` low-level `hash_secret_raw`, type ID) for one fixed linkSecret and passphrase, and assert `linkId`, `token` and the decryption of a Python-produced ciphertext (fixed IV, the AAD rule) match. Paste the Python snippet as a comment above the vectors. Also: round trip; wrong passphrase, wrong link, changed AAD (other linkId) and a flipped ciphertext byte all throw; two encryptions of one plaintext have different IVs; Review Focus 1: `"Apple  Banana-cherry\n"` and `"apple banana cherry"` derive the same keys; `parseLinkSecret` accepts the secret followed by `.` or `)` and rejects 42 and 44 chars and non-base64url; `generatePassphrase` yields five list words, and rejection sampling is exercised by stubbing `getRandomValues` with a value above the largest multiple of 7776.
- [ ] **Step 3-4: Implement, run** `docker compose exec frontend npx vitest run --project unit src/lib/guestCrypto.unit.test.ts`.
- [ ] **Step 5: Commit** `feat(guest): link and passphrase cryptography`.

### Task 8: The copy format and its validator

**Files:**
- Create: `frontend/src/lib/treeEntities.ts`, `frontend/src/lib/guestCopy.ts`, `frontend/src/lib/guestCopy.unit.test.ts`
- Modify: `frontend/src/hooks/useTreeData.ts` (re-export from `treeEntities.ts`), importers of `filterByPerson` and the `Decrypted*` types used by the components in Task 11

**Interfaces:**
- Produces:
  - `treeEntities.ts`: the `Decrypted*` interfaces and `filterByPerson`, moved from `useTreeData.ts` (which imports Sentry and the API client, so nothing on the guest page may import it as a value). `useTreeData.ts` re-exports them so existing imports keep working.
  - `guestCopy.ts`: `GUEST_COPY_VERSION = 1`; `interface GuestCopy { version: 1; publishedAt: string; language: "en" | "nl"; treeName: string; persons; relationships; events; lifeEvents; turningPoints; classifications; patterns; siblingGroups }` (arrays of the `Decrypted*` shapes); `buildGuestCopy(input: GuestCopyInput, now: Date, language): GuestCopy` projecting each entity through an explicit field list (one `const` array per entity, typed so a missing field is a compile error); `parseGuestCopy(raw: unknown): GuestCopy` that throws `GuestCopyError` on any mismatch; `guestCopyToState(copy): GuestTreeState` returning the same maps as `DemoTreeState`; `summarizeGuestCopy(input): { persons: number; events: number; patterns: number }` for the dialog line.
  - Validation rules: exact version; every id a string of at most 64 chars; strings at most 20 000 chars (names and titles 500); counts at most 5 000 per entity type; enums (relationship type, period status, trauma and life-event category, classification status, DSM category and subcategory, gender as the app stores it) from the existing domain constants; pattern colour from the palette in `lib/patternColors.ts`; years integers 0..3000 or null; references (person ids in relationships, events, patterns, sibling groups; pattern linked entities) must resolve, else reject. Unknown keys reject.

- [ ] **Step 1: Failing tests:** `buildGuestCopy` drops a field not in the list (pass an object with an extra `secret` key) and has no journal key at all; output passes `parseGuestCopy`; `parseGuestCopy` rejects: version 2, unknown top-level key, unknown entity key, a `javascript:`-style colour, an unknown category, a dangling person reference, an over-long string, a number where a string belongs, `__proto__` keys; `guestCopyToState` round-trips the demo fixture (build it from `buildDemoState`).
- [ ] **Step 2-4: Run, implement, run; `npx tsc -b`.**
- [ ] **Step 5: Commit** `feat(guest): copy format with strict validation`.

### Task 9: API clients

**Files:**
- Modify: `frontend/src/lib/api.ts`, `frontend/src/types/api.ts`
- Create: `frontend/src/guest/guestApi.ts`, `frontend/src/guest/guestApi.unit.test.ts`
- Test: the existing api unit test file for `api.ts`

**Interfaces:**
- Produces in `api.ts`: `listGuestLinks(treeId)`, `createGuestLink(treeId, body: GuestLinkCreate)`, `republishGuestLink(treeId, id, ciphertext)`, `extendGuestLink(treeId, id, days)`, `unlockGuestLink(treeId, id)`, `deleteGuestLink(treeId, id)`; types `GuestLink` (mirrors `GuestLinkOut`) and `GuestLinkCreate`.
- `guestApi.ts` (plain `fetch`, `credentials: "omit"`, `cache: "no-store"`, `referrerPolicy: "no-referrer"`, no import of `lib/api`): `openGuestLink(linkId, token): Promise<GuestOpenResult>` with `GuestOpenResult = { kind: "ok"; ciphertext: string } | { kind: "not_available" | "locked" | "wrong_passphrase" | "rate_limited" | "offline" | "error" }` (404, 423, 401, 429, network failure, anything else).

- [ ] **Step 1-4:** tests with a stubbed `fetch` for each status mapping and the request options; implement; run.
- [ ] **Step 5: Commit** `feat(guest): api clients`.

### Task 10: Separate guest build and nginx locations

**Files:**
- Create: `frontend/view.html`, `frontend/vite.guest.config.ts`, `frontend/src/guest/main.tsx` (placeholder `GuestApp` rendering "Loading…" until Task 12), `frontend/src/guest/i18n.ts`, `frontend/scripts/check-guest-bundle.mjs`, `scripts/test-nginx-guest.sh`
- Modify: `frontend/package.json` (build script), `frontend/nginx.conf`, `frontend/tsconfig.app.json` (include if needed), `frontend/knip.json` (new entry), `Makefile` (target `test-nginx-guest`), `.github/workflows/ci.yml` (run the bundle check and the nginx test)

Decisions:
- A second Vite build: `vite build -c vite.guest.config.ts` with `base: "/view-assets/"`, input `view.html`, `outDir: "dist/view-assets"`, `emptyOutDir: true`, no Sentry plugin, `sourcemap: false`. Every request the guest page makes is then `/view`, `/view-assets/*` or `/api/guest/open`, which is what the Cloud Logging exclusion filters on. Build script becomes `tsc -b && vite build && vite build -c vite.guest.config.ts && npm run prerender`.
- `view.html`: no inline scripts, no external links, `<link rel="icon" href="data:,">`, `<meta name="robots" content="noindex">`, `<meta name="referrer" content="no-referrer">`, system font stack.
- `guest/i18n.ts`: i18next with resources imported statically from `public/locales/{en,nl}/translation.json` (no HTTP backend, so no `/locales/` request), language detection order `hostname`, `navigator` with `caches: []`; the copy's `language` is applied after opening.
- nginx: `location = /view { access_log off; <full header set>; try_files /view-assets/view.html =404; }` with `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex` and `$guest_csp` = `default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'`; `location ^~ /view-assets/ { access_log off; <same headers but immutable caching>; }`; `location = /view-assets/view.html { return 404; }`; `location = /view.html { return 404; }`; `location ^~ /view/ { access_log off; return 301 /view; }`; `location = /api/guest/open { access_log off; limit_req zone=auth_general burst=5 nodelay; ...proxy as /api/ plus the Task 1 headers }`; `location ~ ^/api/trees/[^/]+/guest-links { client_max_body_size 8m; ...proxy, rate limit as /api/ }`. Repeat the full header set in each location (see the existing comment on `add_header` inheritance). Check that the argon2 WASM file loads under `/view-assets/`.
- `check-guest-bundle.mjs`: reads every file under `dist/view-assets` and fails if any contains `sentry` (case-insensitive), `fonts.googleapis`, `fonts.gstatic`, `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, or the API client's refresh path `/auth/refresh`. If a dependency legitimately contains one of these strings (for instance i18next's language detector references `localStorage`), do not import that dependency on the guest page rather than loosening the check.
- `test-nginx-guest.sh`: builds the production frontend image, runs it with a dummy `API_URL` pointing at a tiny echo container (or `nc`) that records headers, and asserts with `curl`: `/view` 200 with the guest CSP, `no-store`, `no-referrer`, `noindex`; `/view.html` and `/view-assets/view.html` 404; `/view/` 301 to `/view`; a forged `X-Real-IP` and `X-Proxy-Secret` sent by the client are replaced upstream; requests to `/view`, `/view-assets/x` and `/api/guest/open` leave no line in the container's access log while `/` does.

- [ ] **Step 1:** write `test-nginx-guest.sh` and the bundle check; run them and see them fail.
- [ ] **Step 2:** implement the build, entry and nginx locations.
- [ ] **Step 3:** `npm run build` in the frontend container, `node scripts/check-guest-bundle.mjs`, `make test-nginx-guest`, `npx tsc -b`, knip. All pass.
- [ ] **Step 4: Commit** `feat(guest): separate view entry and nginx locations`.

### Task 11: Read-only views without the app shell

**Files:**
- Create: `frontend/src/guest/GuestTreeView.tsx` (+ `.css`, `.test.tsx`)
- Modify: whichever of `DemoPersonCard`, `PatternFocusPanel`, `PersonNode`, `SiblingGroupNode`, `RelationshipEdge`, `useTreeLayout`, `FamilyStripesView`, `PatternView` import a value from `useTreeData`, `lib/api`, `useEncryption` or Sentry, directly or transitively: switch them to `lib/treeEntities`. `DemoPersonCard` and `PatternView` render `react-router` `Link`s into the app: add a prop (`linksToApp?: boolean`, default true) that renders plain text instead, and generalise `DemoPersonCard`'s `state` prop to the shared maps type.

**Interfaces:**
- Consumes: `GuestTreeState` from Task 8.
- Produces: `GuestTreeView({ state, publishedAt }: { state: GuestTreeState; publishedAt: string })` with three tabs (Tree, Timeline, Patterns; local state, no router), a "View only, published {date}" label, the canvas as in `DemoCanvas` (person click opens the person card), `FamilyStripesView` with its own local view state, and `PatternView readOnly showReflectionPrompts={false}`. No journal, export, settings or links into the app. If `PatternView` or `FamilyStripesView` needs a router context, wrap the guest app in a `MemoryRouter`.

- [ ] **Step 1: Failing tests:** renders names from a fixture state; clicking a person opens their card; tabs switch; no element has an `href` that starts with `/trees`; the label shows the published date.
- [ ] **Step 2-4: Implement, run tests, `npm run build` and the bundle check from Task 10, `npx tsc -b`.** The existing demo and workspace tests must still pass.
- [ ] **Step 5: Commit** `feat(guest): read-only tree, timeline and patterns for the guest page`.

### Task 12: The guest page flow

**Files:**
- Create: `frontend/src/guest/GuestApp.tsx` (+ `.css`, `.test.tsx`), `frontend/src/guest/useGuestSession.ts` (+ `.test.tsx`)
- Modify: `frontend/src/guest/main.tsx`, both translation files (keys under `guest.`)

**Interfaces:**
- Consumes: Tasks 7, 8, 9, 11.
- Produces: `useGuestSession()` returning `{ state: GuestPageState; open(passphrase: string): Promise<void> }` where `GuestPageState` is one of `no_link | malformed_link | ready | opening | wrong_passphrase | locked | not_available | rate_limited | offline | undecryptable | open | ended_idle` (`open` carries the `GuestTreeState` and `publishedAt`).

Behaviour: on mount read `location.hash`, call `history.replaceState(null, "", "/view")` immediately, then `parseLinkSecret`; keep the secret in a ref only. `open` derives keys, calls `openGuestLink`, decrypts, `JSON.parse`, `parseGuestCopy`; a decrypt or validation failure is `undecryptable` and renders nothing of the copy. On `pagehide` and after 15 minutes without pointer, key or scroll activity, drop the secret, keys and state (`ended_idle` asks for the original link again). The ready screen shows a short explanation, the usage notice ("The person who shared this can see when it was last opened, how often, and from how many networks."), a passphrase field (`autocomplete="off"`, `spellcheck={false}`, `autoCapitalize="none"`) and Open. Theme: read the existing theme setting if present, never write.

- [ ] **Step 1: Failing tests** (stub `openGuestLink` and use a real copy encrypted in the test): each state is reachable and shows its message; the hash is cleared before any network call; Review Focus 2: a fragment with a trailing `)` opens, a 30-char fragment is `malformed_link` and makes no request; a hostile copy (bad colour) is `undecryptable`; `pagehide` and the idle timer (fake timers) clear the view; spy on `Storage.prototype.setItem`, `indexedDB.open` and `document.cookie` setter: never called.
- [ ] **Step 2-4: Implement, run, build plus bundle check, `npx tsc -b`.**
- [ ] **Step 5: Commit** `feat(guest): passphrase flow and session handling`.

### Task 13: Owner UI in the share dialog

**Files:**
- Create: `frontend/src/components/GuestLinksSection.tsx` (+ `.css`, `.test.tsx`), `frontend/src/hooks/useGuestLinks.ts` (+ `.test.tsx`), `frontend/src/lib/publishGuestCopy.ts` (+ `.unit.test.ts`)
- Modify: `frontend/src/components/ShareTreeDialog.tsx`, `frontend/src/pages/TreeListPage.tsx` (show Share when `tree_sharing` or `guest_links` is on, or the tree has links), both translation files

**Interfaces:**
- Consumes: Tasks 7, 8, 9; the tree key from the encryption context (as `ShareTreeDialog` already obtains it).
- Produces: `publishGuestCopy({ treeId, treeKey, linkSecret, passphrase, language, fetchAll }): Promise<{ linkId; token; ciphertext }>` where `fetchAll` fetches and decrypts every entity type except the journal fresh (no query cache) and throws if any item fails; throws `GuestCopyTooLargeError` above 5 MB. Owner blob: `encryptForApi({ linkSecret, passphrase, label }, treeKey)`. `useGuestLinks(treeId)` with list, create, republish, extend, unlock, end mutations.

UI per the spec sketch: "Share by link" with label ("For (only you see this)"), "Lasts" select (1, 7, 14, 30 days; 7 preselected), the summary line from `summarizeGuestCopy` ending "Not your journal.", Create link. Each link: label, "until {date}", link with Copy, passphrase with Copy, "Send these two separately.", "Published {date}" with "Update what they see", usage line (times opened, last opened, networks; "100 or more"; "networks unavailable" when `network_count` is null; the explanation line about networks not being people), wrong-passphrase count, "Locked after too many wrong passphrases" with Unlock when locked, Extend (same choices), End link with a confirm that says it cannot undo what was already seen. No combined copy button. The section is hidden when `guest_links` is off and the tree has no links; with the flag off and links present, only listing and End are shown.

- [ ] **Step 1: Failing tests:** `publishGuestCopy` output decrypts with the guest-side derivation to a copy without journal data and without the tree key string (search the plaintext for it); a failing entity fetch rejects and nothing is posted; Review Focus 5: a 6 MB copy throws the too-large error and the dialog shows the message, as it does for an API 413; Review Focus 3: editing a person does not call republish, the Update button does; dialog renders each line from a fixture link; End asks to confirm; flag-off hides create.
- [ ] **Step 2-4: Implement, run, `npx tsc -b`, React Doctor.**
- [ ] **Step 5: Commit** `feat(sharing): share a tree by link from the share dialog`.

### Task 14: End-to-end journey

**Files:**
- Create: `frontend/e2e/guest-links.spec.ts`
- Modify: `api/app/routers/testing.py` only if a test-only hook is needed to expire a link (`POST /test/guest-link-expire`, behind `ENABLE_TEST_RESET`)

- [ ] **Step 1:** following `tree-sharing.spec.ts` (flag helper with `guest_links`), write: owner creates a tree with a person, creates a link, reads link and passphrase from the dialog; a fresh context opens the link, sees the passphrase screen, enters it with different capitalisation, sees the person, opens the timeline and patterns, confirms `location.hash` is empty and `localStorage` has no new keys; owner renames the person and clicks Update, the guest reloads with the original link and sees the new name; usage line shows opened twice; 10 wrong passphrases lock it, owner unlocks; owner extends; owner ends, guest gets "not available"; an expired link gives "not available". Record every request the guest context makes and assert all are same-origin and under `/view`, `/view-assets/` or `/api/guest/open`.
- [ ] **Step 2:** run `docker compose exec frontend npx playwright test e2e/guest-links.spec.ts`; fix what fails in the owning task's code.
- [ ] **Step 3: Commit** `test(e2e): guest link journey`.

### Task 15: Documents

**Files:**
- Modify: `frontend/src/pages/PrivacyPage.tsx` / its translation keys, `frontend/src/pages/SecurityPage.tsx` / keys, `SECURITY.md`, `AGENTS.md` (API design, routing `/view`, components, domain model `GuestLink`, scope: move "share links for people without an account" out of Deferred), `docs/roadmap.md`

- [ ] **Step 1:** privacy policy: what a guest link stores (encrypted copy, keyed network hashes, counts, dates), retention (until ended or expired, then deleted), that hosting errors may be logged briefly, and that the sharer sees the usage figures. Security page and SECURITY.md: the threat model table from the spec, and correct the line saying opened data "stays on their device". Both languages, copy rules from Global Constraints; run the humanizer rules on new prose.
- [ ] **Step 2:** `make quality`, `npx react-doctor@0.4.0`, `bash scripts/privacy-scan.sh`, `docker compose exec api uv run bandit -r app/`; all clean.
- [ ] **Step 3: Commit** `docs(sharing): guest links in privacy, security and project docs`.

---

## Release steps (owner, not part of the build)

These touch production and need the owner's go-ahead; the build leaves the feature off.

1. Create a Secret Manager secret `proxy-shared-secret` (32+ random bytes), then add `PROXY_SHARED_SECRET=proxy-shared-secret:latest` to `--set-secrets` for `traumabomen-api` and `traumabomen-frontend` in `deploy.yml`.
2. After deploying, send a request with a forged `X-Real-IP` and `X-Proxy-Secret` directly to the API service URL and through the site, and confirm neither is treated as verified (the API warning appears only for the direct call).
3. Add a Cloud Logging exclusion for `run.googleapis.com/requests` where `httpRequest.requestUrl` matches `/view`, `/view-assets/` or `/api/guest/` (frontend) and `/guest/` (API), and check one guest visit leaves no entry.
4. Turn on `guest_links` for selected testers in the admin dashboard.
