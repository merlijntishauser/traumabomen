# Read-Only Tree Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user share one tree, read-only, with another registered user (or invite someone without an account), without the server ever seeing the tree key in plaintext.

**Architecture:** Each user gets an RSA-OAEP key pair; the private key is encrypted under the master key and stored server-side. The owner's client wraps the tree's AES key with the recipient's public key and stores the wrapped key in a `tree_shares` row. A new `get_readable_tree` dependency lets an active recipient GET a tree's entities (never journal entries); every write stays behind `get_owned_tree`. The frontend merges unwrapped shared keys into `treeKeys` and renders the workspace in a read-only mode. The owner-facing UI is behind a `tree_sharing` feature flag, so trunk stays shippable at every commit.

**Tech Stack:** FastAPI + SQLAlchemy async + Alembic; React 19 + TanStack Query + Web Crypto (RSA-OAEP, AES-GCM); Vitest, pytest, Playwright.

**Spec:** `docs/plans/2026-03-01-read-only-tree-sharing-design.md`. This plan deviates from it where the code changed since March, or where the spec had a gap; each deviation is marked **[deviation]** with its reason.

## Global Constraints

- RSA-OAEP, `modulusLength: 4096`, `publicExponent: [1, 0, 1]`, `hash: "SHA-256"`. Keys exchanged as JWK JSON strings.
- The private key is only ever sent encrypted: `encryptForApi(jwk, masterKey)` (AES-256-GCM, fresh IV). Never log it, and never put it in local or session storage.
- Shared tree keys go into `treeKeys` only, **never** into `keyRingBase64`: the owner's key ring must never contain someone else's tree.
- Emails are normalized with `.strip().lower()` everywhere, the same as `/auth/register` and `/auth/login`.
- Share creation is rate-limited with `check_endpoint_rate_limit(ip, "tree-share")`, and `GET /auth/public-key/{email}` with `"public-key-lookup"`. A user may have at most 20 pending shares across all trees.
- Status values: `pending` | `active`. **[deviation]** The spec says both "status revoked" and "revoke by deleting the grant". Delete wins: the unique `(tree_id, recipient_email)` constraint then lets the owner share again later, and the server keeps no record of who once had access.
- Feature flag key `tree_sharing`, seeded with `audience = 'disabled'`. It gates **creating** shares (server 403 `sharing_not_enabled`) and the owner's Share entry. Key-pair generation and the "Shared with me" section are not gated: they are invisible until someone shares with you.
- `display_name` is stored in **plaintext** (max 100 chars). The UI copy has to say so, and that the people you share with can see it.
- Copy rules: sentence case, no exclamation marks, no `--` or em dashes, no emoji, EN and NL keys in lockstep. Icons from Lucide only (`Share2`, `Eye`, `Users`).
- Trunk-based: commit each task straight to `main`, no Co-Authored-By lines. Typecheck with `npx tsc -b` (not `--noEmit`). After the frontend tasks, run react-doctor 0.4.0 and expect a score of 100.

## Review Focus

1. **A viewer's interaction still fires a write.** Dragging a node, blurring an autosave field, pressing `n` or Cmd+Z, or the context menu: a reasonable person expects nothing to change and no error toast. Pinned in Task 9 (`issues no write requests in read-only mode`).
2. **Unlock when a sharing call fails or a grant is corrupt.** For example, a 500 from `/auth/shared-keys`, or a grant wrapped for an older key pair. Unlock must still succeed with your own trees; only the bad grant is skipped. Pinned in Task 6 (`loadSharing never rejects`).
3. **Passphrase change.** The private key has to be re-encrypted in the same request as the key ring, or shared trees silently stop opening after the change. An iOS `PUT /auth/key-ring` that omits the field must leave it alone. Pinned in Tasks 2 and 6.
4. **Revoked while open.** The owner removes access while the viewer has the tree open. The next fetch returns 404, and the viewer should see "This tree is no longer shared with you" rather than a broken canvas. Pinned in Task 9.
5. **Odd recipient input.** Your own email, `Mixed@Case.com ` with spaces, an email already shared, or a 21st pending invite. Expect a clear message for each, never a duplicate row or a second invite email. Pinned in Task 4.

---

### Task 1: Data model, migration, feature flag

**Files:**
- Modify: `api/app/models/user.py`, `api/app/models/tree.py`, `api/app/models/__init__.py`
- Create: `api/app/models/tree_share.py`
- Create: `api/alembic/versions/<rev>_add_tree_sharing.py` (down_revision `9e3f1b7c5a2d`)
- Test: `api/tests/integration/test_tree_shares_model.py`

**Interfaces:**
- Produces: `User.display_name: str | None` (String(100)), `User.public_key: str | None` (Text), `User.encrypted_private_key: str | None` (Text).
- Produces: `TreeShare(id, tree_id FK trees CASCADE, owner_id FK users CASCADE, recipient_email String(255), recipient_id FK users CASCADE nullable, encrypted_tree_key Text nullable, status String(16) default "pending", created_at)`, with `UniqueConstraint("tree_id", "recipient_email", name="uq_tree_shares_tree_recipient")` and indexes on `recipient_id` and `recipient_email`.
- Produces: `Tree.shares` relationship, `cascade="all, delete-orphan"`.
- **[deviation]** `recipient_id` is ON DELETE CASCADE, not left dangling: when a recipient deletes their account, their grants go with it.

- [ ] **Step 1: Write the failing tests:** `test_share_unique_per_tree_and_email` (a second insert raises IntegrityError), `test_share_deleted_with_tree`, `test_share_deleted_with_recipient_account`, `test_share_deleted_with_owner_account`.
- [ ] **Step 2: Run** `docker compose exec api uv run pytest tests/integration/test_tree_shares_model.py -v`. Expected: FAIL (ImportError).
- [ ] **Step 3: Implement the models and the migration.** The migration adds the three user columns, creates `tree_shares`, and runs `INSERT INTO feature_flags (key, audience) VALUES ('tree_sharing', 'disabled')`. The downgrade reverses all of it.
- [ ] **Step 4: Run the tests** (SQLite by default). Then run `docker compose exec api uv run alembic upgrade head && uv run alembic downgrade -1 && uv run alembic upgrade head` against Postgres. Expected: PASS, with no errors in either direction.
- [ ] **Step 5: Commit** `feat(api): tree share model and user key columns`

### Task 2: Key pair and profile endpoints

**Files:**
- Create: `api/app/routers/sharing_keys.py` (prefix `/auth`), registered in `api/app/main.py`
- Modify: `api/app/schemas/auth.py` (`KeyRingUpdate`), `api/app/routers/key_ring.py` (`update_key_ring`)
- Test: `api/tests/integration/test_sharing_keys.py`, plus additions in `test_key_ring.py`

**Interfaces:**
- `GET /auth/keys` -> `{ public_key: str, encrypted_private_key: str }`, or 404 `"No key pair"`. **[deviation]** The spec has no way for the client to read back its own encrypted private key on unlock, so this endpoint is added.
- `PUT /auth/keys` body `{ public_key: str (max 16384), encrypted_private_key: str (max 32768) }`. Returns 200 when none exists yet. If one exists, it returns 409 `"key_pair_exists"` unless `public_key` equals the stored one (idempotent retry).
- `GET /auth/public-key/{email}` -> `{ public_key: str }`. Returns 404 `"No key"` when there is no such user or the user has no key; the same message for both, so the response does not tell you which. Rate-limited as `"public-key-lookup"`.
- `PUT /auth/profile` body `{ display_name: str | null (max 100, stripped; "" -> null) }` -> `{ display_name }`.
- `GET /auth/profile` -> `{ display_name: str | None }`.
- `KeyRingUpdate` gains `encrypted_private_key: str | None = Field(default=None, max_length=32768)`. When it is not None, `update_key_ring` sets it in the same commit; when it is None, the stored value is left unchanged.

- [ ] **Step 1: Write the failing tests:** `test_put_keys_once_then_409`, `test_put_keys_same_public_key_is_idempotent`, `test_get_keys_404_before_upload`, `test_public_key_requires_auth` (401), `test_public_key_unknown_email_and_keyless_user_same_404`, `test_public_key_lookup_normalizes_email` (`" Bob@X.org"` finds `bob@x.org`), `test_profile_display_name_roundtrip_and_clear`, `test_key_ring_put_with_private_key_updates_both`, `test_key_ring_put_without_private_key_leaves_it`.
- [ ] **Step 2: Run** them. Expected: FAIL (404 route).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `uv run pytest tests/integration/test_sharing_keys.py tests/integration/test_key_ring.py -v`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): user key pair, public key lookup and display name`

### Task 3: Read access for share recipients

**Files:**
- Modify: `api/app/dependencies.py`, `api/app/routers/trees.py` (`get_tree` only), `persons.py`, `relationships.py`, `sibling_groups.py`, `crud_helpers.py` (`create_linked_entity_router`: `list_all` and `get_one` only)
- Test: `api/tests/integration/test_shared_read_access.py`

**Interfaces:**
- Produces: `async def get_readable_tree(tree_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> Tree`. It returns the tree when `Tree.user_id == user.id`, OR when a `TreeShare` exists with `tree_id`, `recipient_id == user.id` and `status == "active"`. Otherwise it raises 404 `"Tree not found"` (the same detail as `get_owned_tree`, so a non-owner cannot probe whether a tree exists).
- Unchanged and still owner-only: every POST, PUT and DELETE route, `/trees/{id}/sync`, `GET /trees` (the list), and **all** of `journal.py`.

- [ ] **Step 1: Write the failing tests.** Use a fixture `shared_with(recipient)` that inserts an active share row directly. Then: `test_viewer_can_get_each_readable_endpoint`, parametrized over tree, persons, relationships, events, life-events, classifications, patterns, turning-points and sibling-groups, list and single; `test_viewer_cannot_write_each_endpoint`, parametrized over POST, PUT and DELETE plus `/sync`, each expecting 404; `test_viewer_journal_404`; `test_pending_share_grants_no_access`; `test_unrelated_user_404`; `test_shared_tree_absent_from_viewer_tree_list`.
- [ ] **Step 2: Run** them. Expected: the GET cases FAIL with 404.
- [ ] **Step 3: Implement `get_readable_tree`** and swap it in on the GET routes listed above, and nowhere else.
- [ ] **Step 4: Run** `uv run pytest tests/integration -q`. Expected: everything passes, including the existing ownership-isolation tests.
- [ ] **Step 5: Commit** `feat(api): read-only tree access for share recipients`

### Task 4: Share endpoints and invite email

**Files:**
- Create: `api/app/routers/shares.py` (both routers), `api/app/schemas/shares.py`; register in `api/app/main.py`
- Modify: `api/app/email.py` (`send_share_invite_email`), `api/app/routers/features.py` (expose `async def user_has_flag(db, user, key) -> bool` built on `_is_flag_enabled`)
- Test: `api/tests/integration/test_shares.py`, `api/tests/unit/test_email.py` (invite case)

**Interfaces (all owner routes use `get_owned_tree`):**
- `ShareResponse = { id, tree_id, recipient_email, recipient_display_name: str | None, status, created_at }`
- `GET /trees/{tree_id}/shares` -> `list[ShareResponse]`
- `POST /trees/{tree_id}/shares` body `{ recipient_email: EmailStr, encrypted_tree_key: str | None (max 2048) }` -> 201 `ShareResponse`. The rules, checked in this order:
  - 403 `sharing_not_enabled` when the user does not have the flag
  - rate limit
  - 422 `cannot_share_with_self`
  - 409 `already_shared`
  - If the recipient exists **and** has a `public_key`: `encrypted_tree_key` is required (422 `encrypted_tree_key_required` if it is missing), the share is created `active`, and `recipient_id` is set.
  - Otherwise it is created `pending`, with the key ignored and stored null. The cap is checked first (409 `pending_share_limit` when the user already has 20 pending shares). The invite email is sent **only if the recipient has no account**; an existing user without a key pair gets no email, because they will produce a key pair on their next unlock.
- `PUT /trees/{tree_id}/shares/{share_id}` body `{ encrypted_tree_key: str }` -> `ShareResponse`. It sets the key, `recipient_id` and `status="active"`. Returns 409 `recipient_has_no_key` if the recipient still has no key, and 409 `already_active` if the share is already active.
- `DELETE /trees/{tree_id}/shares/{share_id}` -> 204.
- `GET /auth/shared-keys` -> `list[{ share_id, tree_id, encrypted_tree_key, owner_display_name, owner_email }]`, active shares only, where `recipient_id == user.id`.
- `GET /auth/pending-shares` -> `list[{ share_id, tree_id, recipient_email, recipient_public_key }]`: the caller's own pending shares whose recipient email now matches a user with a `public_key`. **[deviation]** The response includes the public key, so the owner's client saves one lookup per share.
- `send_share_invite_email(to: str, settings: Settings, language: str = "en") -> None`: built on `_send_cta_email`, with the CTA pointing to `{base_url}/register`. The copy is the spec's text, verbatim, plus an NL version. The owner's name or email is not included.

- [ ] **Step 1: Write the failing tests:** `test_share_requires_flag`, `test_share_active_with_keyed_recipient`, `test_share_requires_wrapped_key_for_keyed_recipient`, `test_share_pending_for_unknown_email_sends_invite` (patch `send_email_background` and assert one call), `test_share_pending_for_keyless_user_sends_no_email`, `test_share_normalizes_email`, `test_cannot_share_with_self` (including different case), `test_duplicate_share_409`, `test_pending_cap_20`, `test_complete_pending_share`, `test_complete_requires_recipient_key`, `test_revoke_removes_access` (the viewer's GET returns 404 afterwards), `test_non_owner_cannot_list_create_complete_or_revoke`, `test_shared_keys_lists_only_active_for_me`, `test_pending_shares_lists_only_completable`, `test_reshare_after_revoke`. Plus the unit test `test_send_share_invite_email_en_nl`.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `uv run pytest -q && uv run mypy app/ && uv run bandit -r app/`. Expected: all pass and no findings.
- [ ] **Step 5: Commit** `feat(api): create, complete and revoke tree shares`

### Task 5: Frontend crypto and API client

**Files:**
- Modify: `frontend/src/lib/crypto.ts`, `frontend/src/lib/api.ts`, `frontend/src/types/api.ts`
- Test: `frontend/src/lib/sharingCrypto.unit.test.ts` (Node has WebCrypto), additions in `frontend/src/lib/api.test.ts`

**Interfaces (crypto.ts):**
- `generateShareKeyPair(): Promise<{ publicJwk: string; privateJwk: string }>`: the JWK JSON strings. The pair is generated extractable only long enough to export it.
- `importSharePublicKey(publicJwk: string): Promise<CryptoKey>`, with usages `["encrypt"]`.
- `importSharePrivateKey(privateJwk: string): Promise<CryptoKey>`, with usages `["decrypt"]` and **non-extractable**.
- `wrapTreeKey(treeKeyBase64: string, recipientPublicKey: CryptoKey): Promise<string>`: base64 of the RSA-OAEP ciphertext of the raw 32 bytes.
- `unwrapTreeKey(wrapped: string, privateKey: CryptoKey): Promise<CryptoKey>`: the AES-GCM key, imported the same way `importTreeKey` does it.

**Interfaces (api.ts):** `getKeyPair`, `putKeyPair`, `getPublicKey(email)` (with the email URL-encoded), `getProfile`, `updateProfile`, `getShares(treeId)`, `createShare(treeId, body)`, `completeShare(treeId, shareId, key)`, `deleteShare(treeId, shareId)`, `getSharedKeys()`, `getPendingShares()`. Also `updateKeyRing(encrypted_key_ring: string, encrypted_private_key?: string)`. The response types mirror Task 4 under the same names in `types/api.ts`.

- [ ] **Step 1: Write the failing tests:** `round-trips a tree key through wrap and unwrap` (encrypt with the original, decrypt with the unwrapped key); `unwrap with another pair's private key throws DecryptError`; `imported private key is not extractable`; and in `api.test.ts`, the URL, method and body for each new call.
- [ ] **Step 2: Run** `docker compose exec frontend npx vitest run src/lib/sharingCrypto.unit.test.ts src/lib/api.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** `unwrapTreeKey` maps any `OperationError` to `DecryptError`.
- [ ] **Step 4: Run** the tests again. Expected: PASS.
- [ ] **Step 5: Commit** `feat(crypto): RSA-OAEP key pair and tree key wrapping`

### Task 6: Sharing state on unlock, and passphrase change

**Files:**
- Create: `frontend/src/lib/sharingLoader.ts`
- Modify: `frontend/src/contexts/EncryptionContext.tsx`, `UnlockPage.tsx`, `RegisterPage.tsx`, `components/AuthModal.tsx` (the three `loadOrMigrateKeyRing` call sites), `components/tree/settings/ChangePassphraseSection.tsx` (migrated flow)
- Test: `frontend/src/lib/sharingLoader.unit.test.ts`, `EncryptionContext.test.tsx`, `ChangePassphraseSection.test.tsx`

**Interfaces:**
- `interface SharedTreeInfo { shareId: string; treeId: string; ownerLabel: string }`, where `ownerLabel` is `owner_display_name ?? owner_email`.
- `loadSharing(masterKey: CryptoKey, ownKeyRing: Map<string, string>): Promise<{ sharedKeys: Map<string, CryptoKey>; sharedTrees: Map<string, SharedTreeInfo> }>`. It does the following, in order:
  1. Ensure a key pair. On a 404 from `getKeyPair`, generate one, encrypt the private JWK with `encryptForApi`, and `putKeyPair`. On a 409 from that PUT, re-fetch.
  2. Decrypt and import the private key.
  3. Unwrap each `getSharedKeys()` grant. A failure skips that grant and goes to `Sentry.captureException` with no key material.
  4. For each `getPendingShares()` entry whose `tree_id` is in `ownKeyRing`, wrap and `completeShare`; a failure there is skipped too.

  It **never rejects**: any top-level failure returns empty maps.
- The context gains `sharedTrees: Map<string, SharedTreeInfo>`, `setSharing(keys, trees)` (merges the keys into `treeKeys` only) and `isSharedTree(treeId): boolean`. `CLEAR` resets `sharedTrees`.
- Call sites: after the existing key-ring load succeeds, call `loadSharing(derivedKey, base64Map)` and `setSharing(...)` **without awaiting it before navigation**, so unlock latency is unchanged. A `["shares","received"]` query is invalidated when it resolves.
- In `handleChangePassphraseMigrated`: if `getKeyPair()` succeeds, decrypt the private key with the old key, re-encrypt it with the new key, and pass it to `updateKeyRing(newRing, newEncryptedPrivateKey)`, all in one request.

- [ ] **Step 1: Write the failing tests:** `generates and uploads a key pair when none exists`, `reuses an existing key pair`, `skips a grant that fails to unwrap and keeps the rest`, `completes pending shares only for trees in the own key ring`, `loadSharing never rejects when an endpoint fails`, `shared keys are not added to keyRingBase64` (context), `passphrase change sends the re-encrypted private key with the key ring`, `passphrase change without a key pair omits the field`.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run` and `npx tsc -b`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(sharing): key pair and shared tree keys on unlock`

### Task 7: Owner sharing dialog and display name

**Files:**
- Create: `frontend/src/components/ShareTreeDialog.tsx` (+ `.css`, `.test.tsx`), `frontend/src/hooks/useTreeShares.ts` (+ test)
- Create: `frontend/src/components/tree/settings/DisplayNameSection.tsx` (+ test)
- Modify: `TreeRowMenu.tsx` (optional `onShare`), `TreeListPage.tsx` (passes `onShare` only when `flags.tree_sharing`), `SettingsPanel.tsx` (DisplayNameSection on the security tab, flag-gated), `locales/en|nl/translation.json` (`share.*`, `account.displayName*`)

**Interfaces:**
- `useTreeShares(treeId)` -> `{ shares, share(email), remove(shareId) }`. `share` does the following:
  - On a 404 from `getPublicKey`, it asks the caller to confirm the invite (returns `{ needsInvite: true }`); after confirmation, `createShare` is called with no key.
  - Otherwise it wraps the key from `keyRingBase64.get(treeId)` and calls `createShare`.
  - The API error details map to copy: `cannot_share_with_self`, `already_shared` and `pending_share_limit`, each with its own message.
- `<ShareTreeDialog treeId treeName onClose />` holds:
  - an email field with a Share button
  - the list of current shares (active rows show the display name or email; pending rows say "Invited, waiting for them to set up")
  - `ConfirmDeleteButton` per row, labelled "Remove access"
  - one depth line: "They can see everything in this tree except your journal. Removing access stops new views; anything they already opened stays on their device."
- `DisplayNameSection`: an optional field with helper text "Shown to people you share a tree with. Stored without encryption." (EN and NL).

- [ ] **Step 1: Write the failing tests:** `shares with a registered user using the wrapped key`, `offers an invite for an unknown email and creates a pending share on confirm`, `shows the self-share message`, `removes a share after confirmation`, `Share is absent from the row menu without the flag`, `saves and clears the display name`.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run`, `npx tsc -b` and `npx biome check`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(sharing): share a tree from the tree list`

### Task 8: "Shared with me" on the tree list

**Files:**
- Modify: `frontend/src/pages/TreeListPage.tsx` (+ test), locales
- Create: `frontend/src/hooks/useSharedTrees.ts` (+ test)

**Interfaces:**
- `useSharedTrees()` -> `{ data: { id, name, ownerLabel }[] }`, query key `["shares","received"]`. For each entry in `sharedTrees` from the context, it runs `getTree(id)` and `decrypt`. A 404 drops that entry silently, because revoked access is not an error to the viewer.
- The section is headed "Shared with me" and appears only when there is at least one entry. Each row shows the name, the line "Shared by {ownerLabel}" and an `Eye` "View only" mark, and links to `/trees/{id}`. It has no row menu, and shared trees are not candidates for `LatestTreeBand`.

- [ ] **Step 1: Write the failing tests:** `renders the shared section with owner label and no row menu`, `hides the section when nothing is shared`, `drops a tree that returns 404`.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(sharing): list trees shared with you`

### Task 9: Read-only workspace and views

**Files:**
- Create: `frontend/src/hooks/useTreeAccess.ts` (+ `.test.ts`)
- Modify: `TreeWorkspacePage.tsx`, `WorkspaceRail.tsx`, `ViewTabs.tsx`, `TreeToolbar.tsx`, `WorkspacePanelHost.tsx`, `NodeContextMenu` wiring, `TimelinePage.tsx`, `PatternPage.tsx`, `InsightsPage.tsx`, `JournalPage.tsx`, locales; tests next to each

**Interfaces:**
- `useTreeAccess(treeId: string) -> { readOnly: boolean; ownerLabel: string | null }`, derived from `isSharedTree`.
- In the workspace when `readOnly`:
  - `nodesDraggable={false}`, `nodesConnectable={false}`, no context menu
  - the `n` and Cmd+Z handlers return early
  - the rail shows only pattern focus
  - detail panels render inside `<fieldset disabled className="panel-readonly">`, which disables every input and button through the native mechanism, and their Add and Delete controls are hidden
  - the toolbar shows "View only, shared by {ownerLabel}"
- `ViewTabs` omits the journal tab, and `JournalPage` redirects to `/trees/{id}` when `readOnly`.
- A 404 from `getTree` while `readOnly` renders "This tree is no longer shared with you" with a link back to `/trees`.

- [ ] **Step 1: Write the failing tests:**
  - `issues no write requests in read-only mode`: spy on every mutating `api.ts` export; drag a node, press `n`, press Cmd+Z, blur a person field; assert zero calls.
  - `hides journal tab and add person for a shared tree`
  - `journal route redirects for a shared tree`
  - `shows the no-longer-shared message on 404`
  - `owner workspace is unchanged`: the existing snapshot and controls are still present.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run`, `npx tsc -b`, `make complexity`, `make quality` and `npx react-doctor@0.4.0`. Expected: everything passes, coverage does not drop, and react-doctor scores 100.
- [ ] **Step 5: Commit** `feat(sharing): read-only workspace for shared trees`

### Task 10: End-to-end journeys and docs

**Files:**
- Create: `frontend/e2e/tree-sharing.spec.ts`
- Modify: `api/app/routers/testing.py`: add `POST /test/feature-flag` body `{ key, audience }`, mounted under the same guard as `/test/reset` (only `/test/reset` exists today), with an integration test in `test_testing.py`
- Modify: `AGENTS.md` (the API Design section, the Implemented scope, the TreeShare domain model), `docs/roadmap.md` (#11 status)

- [ ] **Step 1: Write the specs.** `owner shares with a registered user who sees it read-only`: register A and B, set `tree_sharing` to `all` via `POST /test/feature-flag`, A shares, B unlocks, B sees "Shared with me", opens the tree, sees no journal tab, and reloads; A revokes, and B gets the no-longer-shared message. `pending invite completes after the recipient registers`.
- [ ] **Step 2: Run** `docker compose exec frontend npx playwright test e2e/tree-sharing.spec.ts`. Expected: PASS.
- [ ] **Step 3: Update the docs.** Leave the seeded FAQ answer ("sharing is planned") untouched until the flag goes to `all`. That change is a separate guarded migration, following the pattern of `9e3f1b7c5a2d`.
- [ ] **Step 4: Run the full suite:** `docker compose exec api uv run pytest` and `docker compose exec frontend npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit** `test(e2e): tree sharing journeys` and `docs: tree sharing`

## Out of scope (from the spec, plus what changed since)

- Edit permissions, share links for people without an account, out-of-band fingerprint verification, real-time collaboration.
- **The iOS app.** It lists only owned trees and never sends `encrypted_private_key`, which Task 2 makes safe. Showing shared trees on iOS is a follow-up.
- Rotating the tree key on revoke. A removed viewer who kept the key in memory still cannot fetch ciphertext, because the server returns 404. The share dialog states this plainly.
