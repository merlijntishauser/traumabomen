# User Data Export Design

## Problem

Users have no way to back up their tree data. Combined with "passphrase lost = data lost", this is a real risk at scale. The current encryption model (one passphrase-derived key for all trees) also blocks future sharing: you cannot give someone access to one tree without giving them your passphrase.

## Solution

Introduce per-tree encryption keys with a master-key-encrypted key ring. Build encrypted and plaintext export on top of this foundation. Design the key architecture so that read-only sharing (a separate milestone) can be added later without re-working the crypto layer.

## Per-tree key architecture

### Current model

One AES-256-GCM key derived from the user's passphrase via Argon2id. All trees share this key. Passphrase change re-encrypts every blob in every tree.

### New model

- Each tree gets its own random AES-256-GCM key (the **tree key**), generated via `crypto.getRandomValues(new Uint8Array(32))`.
- The user's passphrase-derived key becomes the **master key**. It no longer encrypts tree data directly.
- A **key ring** (JSON object mapping tree IDs to their AES-GCM-encrypted tree keys) is encrypted with the master key and stored server-side as a single blob on the User model.
- On unlock: derive master key, fetch key ring, decrypt it, import all tree keys into memory. Tree operations use the tree key for that specific tree.
- Creating a tree: generate random tree key, encrypt tree data with it, add the encrypted tree key to the key ring, persist both.
- Deleting a tree: remove the entry from the key ring, persist.
- Passphrase change: re-encrypt only the key ring with the new master key. Tree data stays untouched. This replaces the current full re-encryption, which touches every blob.

### Key ring format

```json
{
  "<tree-uuid>": "<base64 AES-GCM encrypted tree key>",
  "<tree-uuid>": "<base64 AES-GCM encrypted tree key>"
}
```

Stored as a single `encrypted_key_ring` text field on the User model. Encrypted with the master key using the same `encrypt()` function (AES-256-GCM, fresh IV).

## Migration

Existing users have all tree data encrypted with their master key. Migration happens client-side, transparently, on the first unlock after the update deploys.

### Flow

1. User unlocks with passphrase, deriving the master key as usual.
2. Client calls `GET /auth/key-ring`. If a key ring exists, the user is already migrated; proceed normally.
3. If no key ring exists (404), enter migration mode:
   - For each tree owned by the user: generate a random tree key.
   - Decrypt all entities (persons, relationships, events, life events, turning points, classifications, patterns, journal entries) with the master key.
   - Re-encrypt each entity with the new tree key.
   - Build the key ring: map of tree ID to tree key encrypted with master key.
   - Send everything in a single `POST /auth/migrate-keys` request.
4. The backend persists the key ring and all re-encrypted data in a single transaction.

### Safety

- Migration is idempotent: if it fails partway, the old single-key data is intact. The client retries on next unlock.
- For a typical user (3 trees, 50 entities), re-encryption takes under 300ms with Web Crypto. This happens during the existing "Deriving encryption key..." spinner, invisible to the user.
- A power user with hundreds of entities might add 1-2 seconds, still within the Argon2id wait.

## Export: encrypted backup

Self-contained JSON file, re-importable into the app by anyone who knows the passphrase.

### File structure

```json
{
  "version": 1,
  "format": "encrypted",
  "exported_at": "2026-02-24T12:00:00Z",
  "tree": { "id": "...", "encrypted_data": "..." },
  "encrypted_tree_key": "...",
  "persons": [{ "id": "...", "encrypted_data": "..." }],
  "relationships": [{ "id": "...", "source_person_id": "...", "target_person_id": "...", "encrypted_data": "..." }],
  "events": [{ "id": "...", "person_ids": ["..."], "encrypted_data": "..." }],
  "life_events": [{ "id": "...", "person_ids": ["..."], "encrypted_data": "..." }],
  "turning_points": [{ "id": "...", "person_ids": ["..."], "encrypted_data": "..." }],
  "classifications": [{ "id": "...", "person_ids": ["..."], "encrypted_data": "..." }],
  "patterns": [{ "id": "...", "encrypted_data": "..." }],
  "journal_entries": [{ "id": "...", "encrypted_data": "..." }]
}
```

The `encrypted_tree_key` is the tree key encrypted with the user's master key. On import, the client derives the master key, decrypts the tree key, verifies one entity decrypts successfully, then creates the tree and uploads all entities via the sync endpoint.

### File naming

`traumatrees-backup-{slugified-tree-name}-{YYYY-MM-DD}.json`

## Export: plaintext JSON

Client decrypts everything and downloads human-readable JSON. Requires explicit user confirmation.

### Confirmation dialog

"This will create an unencrypted file containing all data in this tree, including personal notes, trauma events, and classifications. Store it securely."

### File structure

```json
{
  "version": 1,
  "format": "plaintext",
  "exported_at": "2026-02-24T12:00:00Z",
  "tree": { "name": "My Family Tree" },
  "persons": [
    { "id": "...", "name": "Alice", "birth_year": 1960, "gender": "female", "notes": "..." }
  ],
  "relationships": [
    { "id": "...", "source_id": "...", "target_id": "...", "type": "biological_parent", "periods": [] }
  ],
  "events": [{ "id": "...", "title": "...", "category": "loss", "person_ids": ["..."] }],
  "life_events": [],
  "turning_points": [],
  "classifications": [],
  "patterns": [],
  "journal_entries": []
}
```

### File naming

`traumatrees-export-{slugified-tree-name}-{YYYY-MM-DD}.json`

### Not re-importable

Plaintext export cannot be imported back. This is intentional: the import path only accepts encrypted format, keeping it simple and ensuring all imported data goes through the encryption layer.

### Foundation for GEDCOM

The plaintext JSON is the foundation for future GEDCOM export: a converter can transform this JSON into GEDCOM without touching encryption.

## UI

### Export (tree workspace)

Export lives in the existing canvas settings panel (gear icon in the tree toolbar). Two buttons at the bottom of the panel:

- "Download backup (encrypted)": downloads immediately, no confirmation needed.
- "Download as JSON (unencrypted)": opens confirmation dialog, then downloads.

### Import (tree list page)

"Import backup" button next to the existing "New tree" button. Opens a file picker, validates file structure and version, prompts for passphrase confirmation (the encrypted tree key needs the master key to decrypt), then creates the tree via the sync endpoint.

## Backend changes

### User model

One new nullable text field:

- `encrypted_key_ring`: the key ring blob. Null means the user hasn't migrated yet.

### New endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/auth/key-ring` | Return encrypted key ring (404 if not migrated) |
| `PUT` | `/auth/key-ring` | Update key ring (tree create/delete, passphrase change) |
| `POST` | `/auth/migrate-keys` | Migration: accept key ring + re-encrypted data for all trees, persist in single transaction |

### Existing endpoints unchanged

The sync endpoint, tree CRUD, and all entity CRUD already accept encrypted blobs without understanding the content. They work identically whether the blob was encrypted with a master key or a tree key.

### Passphrase change simplification

After migration, passphrase change only re-encrypts the key ring (one small blob) instead of every entity in every tree. The existing bulk re-encryption flow in `EncryptionContext` is replaced with a key-ring-only update.

## Frontend changes

### EncryptionContext

- State changes from `key: CryptoKey | null` to `masterKey: CryptoKey | null` and `treeKeys: Map<string, CryptoKey>`.
- `encrypt(data)` and `decrypt(data)` become tree-scoped: `encrypt(data, treeId)` and `decrypt(data, treeId)`, looking up the tree key from the map.
- Unlock flow: derive master key, fetch key ring, decrypt it, import all tree keys.
- `useTreeData` and `useTreeMutations` already know their `treeId`; threading it into encrypt/decrypt calls is mechanical.

### New components

- Export buttons in the canvas settings panel
- `ExportConfirmDialog` for the plaintext warning
- `ImportButton` on the tree list page
- `ImportDialog` with file picker, validation, and progress

### New hooks

- `useExportTree(treeId)`: assembles all entities, handles both formats, triggers download
- `useImportTree()`: validates file, creates tree + entities via sync

### Migration hook

- `useMigration()`: checks key ring existence on unlock, runs migration if needed, transparent to the rest of the app

## Testing

### Backend

- Key ring CRUD endpoints (create, read, update)
- Migration endpoint: verify transaction atomicity (partial failure rolls back)
- Existing tests unaffected (encrypted blobs are opaque)

### Frontend

- Key ring encrypt/decrypt round-trip
- Migration flow: mock existing single-key data, verify re-encryption produces valid per-tree-key blobs
- Export encrypted: verify file structure, verify re-importability
- Export plaintext: verify all fields present and decrypted
- Import: verify file validation (bad version, corrupt data, wrong passphrase)
- Passphrase change: verify only key ring is re-encrypted (not tree data)

## Future: read-only sharing (separate milestone)

The per-tree key architecture is designed to support sharing without re-working the crypto layer. Key decisions for the sharing milestone:

### Key pairs at registration

Each user gets an asymmetric key pair (X25519 or RSA-OAEP) at registration. The public key is stored server-side in plaintext. The private key is encrypted with the master key and stored alongside the key ring.

### Sharing flow

To share a tree, the sharer encrypts the tree key with the recipient's public key. This "key grant" is stored in a new `TreeShare` model:

- `tree_id`: UUID
- `recipient_user_id`: UUID
- `encrypted_tree_key`: the tree key encrypted with the recipient's public key
- `permission`: `viewer` or `editor`

The recipient unlocks their account, decrypts their private key, then decrypts any shared tree keys. Those join the in-memory tree key map alongside their own trees.

### Access control

Permissions enforced server-side. The backend checks `TreeShare` before allowing API access, in addition to the existing ownership check. Revoking access: delete the `TreeShare` row. The recipient loses API access immediately.

### What to preserve in the export milestone

- The key ring format should be extensible (version field or nested structure) so adding private key storage later doesn't require another migration.
- The `EncryptionContext` tree key map should accept keys from any source (own key ring or shared grants) without distinguishing the two.
- The `GET /auth/key-ring` response could include a `shared_tree_keys` field later, or sharing could use a separate endpoint.

## Not included

- Real-time collaborative editing (conflict resolution, operational transforms)
- GEDCOM export converter (uses plaintext JSON as input; separate feature)
- PDF/image export
- Offline export (requires service worker)
