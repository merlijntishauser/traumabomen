# Read-Only Tree Sharing Design

## Problem

Users cannot share their trees with others. The app is a solo tool, but practitioners, family members, and therapists often need to view a tree together. The per-tree key architecture from the data export milestone (#7) enables sharing individual trees without exposing the user's passphrase.

## Solution

Asymmetric encryption (RSA-OAEP) for key exchange. The sharer encrypts the tree's AES-256-GCM key with the recipient's RSA public key. The recipient decrypts it with their RSA private key. The server never sees tree keys in plaintext.

## Cryptographic architecture

### RSA key pair

RSA-OAEP with 4096-bit modulus and SHA-256. Generated per user on first unlock after deploy (same migration-on-unlock pattern as per-tree keys). Public key stored in plaintext on User model. Private key exported as JWK, encrypted with master key using AES-256-GCM, stored server-side.

Generation flow:
1. `crypto.subtle.generateKey("RSA-OAEP", true, ["encrypt", "decrypt"])` with SHA-256, 4096-bit modulus
2. Export public key as JWK, upload via `PUT /auth/keys`
3. Export private key as JWK, encrypt with master key, upload alongside public key

### Sharing flow (owner's client)

1. Owner enters recipient's email in the sharing panel
2. Client calls `GET /auth/public-key/{email}` to fetch recipient's RSA-OAEP public key
3. If recipient exists: export tree key as raw bytes, encrypt with recipient's public key via `crypto.subtle.encrypt("RSA-OAEP", recipientPublicKey, treeKeyBytes)`, send `POST /trees/{id}/shares` with `{ recipient_email, encrypted_tree_key }`
4. If recipient has no account: create pending share (no `encrypted_tree_key`), server sends invite email

### Receiving flow (recipient's client, on unlock)

1. Fetch shared tree grants via `GET /auth/shared-keys`
2. Decrypt own RSA private key with master key
3. For each grant: `crypto.subtle.decrypt("RSA-OAEP", privateKey, encryptedTreeKey)` to recover tree key
4. Import tree keys into existing `treeKeys` map, marked as read-only

### Pending share completion (owner's client, on unlock)

1. Fetch `GET /auth/pending-shares` (returns pending shares where recipient now has a public key)
2. For each: fetch recipient's public key, encrypt tree key, complete via `PUT /trees/{id}/shares/{share_id}`
3. Automatic, no manual retry needed

## Data model

### User model changes (3 new fields)

- `display_name: String(100), nullable` -- optional name shown to share recipients
- `public_key: Text, nullable` -- RSA-OAEP public key as JWK JSON
- `encrypted_private_key: Text, nullable` -- RSA private key JWK encrypted with master key

### TreeShare model (new)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `tree_id` | UUID FK -> trees | CASCADE delete |
| `owner_id` | UUID FK -> users | The sharer |
| `recipient_email` | String(255) | For pending shares and display |
| `recipient_id` | UUID FK -> users, nullable | Set once recipient account exists |
| `encrypted_tree_key` | Text, nullable | RSA-encrypted tree key, null while pending |
| `status` | String: `pending` / `active` / `revoked` | |
| `created_at` | DateTime | |

Unique constraint on `(tree_id, recipient_email)`.

## API endpoints

### Key pair endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/auth/public-key/{email}` | Fetch user's public key by email (authenticated, 404 if no account/key) |
| `PUT` | `/auth/keys` | Upload own public key + encrypted private key (one-time) |
| `PUT` | `/auth/profile` | Update display name |

### Share endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/trees/{id}/shares` | List all shares for a tree (owner only) |
| `POST` | `/trees/{id}/shares` | Create share. Body: `{ recipient_email, encrypted_tree_key? }`. Null key = pending share + invite email |
| `PUT` | `/trees/{id}/shares/{share_id}` | Complete pending share with `encrypted_tree_key` (owner only) |
| `DELETE` | `/trees/{id}/shares/{share_id}` | Revoke share (owner only) |

### Recipient endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/auth/shared-keys` | All active shares where current user is recipient |
| `GET` | `/auth/pending-shares` | Pending shares where current user is owner and recipient now has public key |

### Read-only access enforcement

New `get_readable_tree` dependency: checks ownership OR active TreeShare. Used on all entity GET endpoints. Write endpoints (`POST`, `PUT`, `DELETE`, `/sync`) keep `get_owned_tree`. Journal entry endpoints excluded from `get_readable_tree` entirely (viewers get 404).

## Frontend changes

### EncryptionContext

- New state: `privateKey: CryptoKey | null`, `sharedTreeIds: Set<string>`
- Unlock flow gains: RSA key pair generation (if missing), shared key loading, pending share completion
- `isSharedTree(treeId): boolean` helper for components

### Tree list page

- Existing "Your trees" section unchanged
- New "Shared with me" section below (only when shared trees exist)
- Shared tree cards: tree name, "Shared by [display_name or email]", read-only badge
- No create/delete/export actions on shared trees

### Tree workspace (read-only mode)

When `isSharedTree(treeId)` is true:
- Toolbar: hide "Add person", "Auto-layout", "Undo"
- Canvas: nodes not draggable, no connection handles, no context menu
- Detail panels: view-only (no edit fields, no save/delete)
- Settings panel: sharing info instead of export/sharing controls
- Journal tab hidden entirely
- "View only" indicator in toolbar

Timeline and pattern views work normally with edit controls hidden.

### Settings panel (owner)

New "Sharing" section below export:
- Email input with "Share" button
- List of current shares (active with display name, pending with status)
- Remove button per share with confirmation
- Non-existent email triggers invite flow ("Send invite" / "Cancel")

### Display name

New text field in settings panel account section, saved via `PUT /auth/profile`. Optional; falls back to email for share recipients.

## Invite email

```
Traumabomen

Someone wants to share a family tree with you.
Create an account to view it.

[Create account]

Or copy this link: {APP_BASE_URL}/register

This invitation does not expire. If you did not
expect this email, you can ignore it.
```

No token needed. Pending share is linked by email, completed when recipient's key pair exists.

## Security

- **Email enumeration**: `GET /auth/public-key/{email}` requires authentication
- **Spam prevention**: rate-limit share creation (10 per 5 min per IP), cap pending shares at 20 per user
- **Key trust**: server-mediated key exchange; same trust model as key ring storage
- **Revocation**: deletes server-side grant, recipient loses API access immediately; data already in browser memory is inherent to client-side decryption
- **Passphrase change**: RSA private key re-encrypted with new master key; key pair unchanged, existing shares remain valid
- **No cross-user leakage**: server never sees tree keys in plaintext

## Testing

### Backend

- TreeShare CRUD, unique constraint, CASCADE deletes
- Share endpoints: create active/pending, complete pending, revoke, duplicate/self-share prevention, non-owner rejection
- Read-only enforcement: viewer GET allowed, viewer POST/PUT/DELETE blocked, viewer journal 404
- `get_readable_tree`: owner access, active share access, revoked/pending/unrelated user 404
- Public key endpoint: auth required, 404 for missing user/key
- Invite email sent on pending share only

### Frontend

- RSA key pair generation, export/import round-trip, encrypt/decrypt tree key
- EncryptionContext: key pair generation on unlock, shared keys loaded, pending shares completed
- TreeListPage: shared section rendering, no edit controls
- TreeWorkspacePage: edit controls hidden, journal tab hidden
- Settings panel: share form, viewer list, revoke

### Integration (Playwright)

- Full share: user A shares with user B, user B sees read-only tree
- Pending share: user A shares with non-existent email, user B registers, user A unlocks completing share, user B sees tree

## Not included (separate milestones)

- Edit permissions for shared trees
- Share links for non-registered users
- Out-of-band key fingerprint verification
- Collaborative real-time editing
