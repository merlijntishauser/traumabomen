# User Data Export Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate from single passphrase-derived key to per-tree encryption keys with a key ring, then add encrypted backup and plaintext JSON export/import.

**Architecture:** Per-tree AES-256-GCM keys stored in a master-key-encrypted key ring blob on the User model. Transparent client-side migration on first unlock. Export assembles all tree entities client-side; import uses existing sync endpoint.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic (backend); React, Web Crypto API, TanStack Query (frontend)

---

### Task 1: Backend - Add encrypted_key_ring to User model

**Files:**
- Modify: `api/app/models/user.py`
- Create: `api/alembic/versions/<auto>_add_encrypted_key_ring.py`

**Step 1: Add field to User model**

In `api/app/models/user.py`, add after `encryption_salt`:

```python
encrypted_key_ring: Mapped[str | None] = mapped_column(Text, nullable=True)
```

Nullable because existing users won't have a key ring until they migrate.

**Step 2: Create Alembic migration**

Run: `docker compose exec api uv run alembic revision --autogenerate -m "add encrypted_key_ring to users"`

Verify the generated migration adds a single column.

**Step 3: Run migration**

Run: `docker compose exec api uv run alembic upgrade head`

**Step 4: Commit**

```bash
git add api/app/models/user.py api/alembic/versions/*_add_encrypted_key_ring*.py
git commit -m "Add encrypted_key_ring column to User model"
```

---

### Task 2: Backend - Add key ring and migration endpoints

**Files:**
- Modify: `api/app/routers/auth.py`
- Modify: `api/app/schemas/auth.py` (if it exists, else the schemas are inline)
- Create: `api/tests/test_key_ring.py`

**Step 1: Add schemas**

Check if `api/app/schemas/auth.py` exists. If schemas are defined inline in the router, add these request/response models:

```python
class KeyRingResponse(BaseModel):
    encrypted_key_ring: str

class KeyRingUpdate(BaseModel):
    encrypted_key_ring: str

class MigrateKeysTree(BaseModel):
    tree_id: uuid.UUID
    encrypted_data: str  # re-encrypted tree name
    persons: list[dict]  # [{id, encrypted_data}]
    relationships: list[dict]
    events: list[dict]
    life_events: list[dict]
    turning_points: list[dict]
    classifications: list[dict]
    patterns: list[dict]
    journal_entries: list[dict]

class MigrateKeysRequest(BaseModel):
    encrypted_key_ring: str
    trees: list[MigrateKeysTree]
```

**Step 2: Add GET /auth/key-ring**

```python
@router.get("/key-ring")
async def get_key_ring(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> KeyRingResponse:
    if not user.encrypted_key_ring:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No key ring")
    return KeyRingResponse(encrypted_key_ring=user.encrypted_key_ring)
```

**Step 3: Add PUT /auth/key-ring**

```python
@router.put("/key-ring", status_code=status.HTTP_200_OK)
async def update_key_ring(
    body: KeyRingUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    user.encrypted_key_ring = body.encrypted_key_ring
    await db.commit()
    return {"message": "Key ring updated"}
```

**Step 4: Add POST /auth/migrate-keys**

This endpoint accepts the key ring + re-encrypted data for all trees in a single transaction:

```python
@router.post("/migrate-keys", status_code=status.HTTP_200_OK)
async def migrate_keys(
    body: MigrateKeysRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    # Verify all trees belong to user
    tree_ids = [t.tree_id for t in body.trees]
    result = await db.execute(
        select(Tree).where(Tree.user_id == user.id, Tree.id.in_(tree_ids))
    )
    owned_trees = {t.id for t in result.scalars().all()}
    for tid in tree_ids:
        if tid not in owned_trees:
            raise HTTPException(status_code=404, detail=f"Tree {tid} not found")

    # Update key ring
    user.encrypted_key_ring = body.encrypted_key_ring

    # Re-encrypt each tree's entities
    for tree_data in body.trees:
        # Update tree encrypted_data
        tree = await db.execute(select(Tree).where(Tree.id == tree_data.tree_id))
        tree_obj = tree.scalar_one()
        tree_obj.encrypted_data = tree_data.encrypted_data

        # Update all entity types
        for person in tree_data.persons:
            await db.execute(
                update(Person).where(Person.id == person["id"]).values(encrypted_data=person["encrypted_data"])
            )
        # ... same for relationships, events, life_events, turning_points, classifications, patterns, journal_entries

    await db.commit()
    return {"message": "Migration complete"}
```

**Step 5: Write tests**

In `api/tests/test_key_ring.py`:
- Test GET /auth/key-ring returns 404 when no key ring
- Test PUT /auth/key-ring stores and GET returns it
- Test POST /auth/migrate-keys updates key ring + all entity data in single transaction
- Test POST /auth/migrate-keys rejects trees not owned by user

**Step 6: Run tests**

Run: `docker compose exec api uv run pytest tests/test_key_ring.py -v`
Run: `docker compose exec api uv run pytest` (full suite)

**Step 7: Commit**

```bash
git commit -m "Add key ring and migration endpoints"
```

---

### Task 3: Frontend - Add key ring crypto functions

**Files:**
- Modify: `frontend/src/lib/crypto.ts`
- Modify: `frontend/src/lib/crypto.test.ts`

**Step 1: Add generateTreeKey function**

```typescript
export async function generateTreeKey(): Promise<CryptoKey> {
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  return crypto.subtle.importKey(
    "raw", rawKey, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]
  );
}
```

Note: `extractable: true` so we can export the raw key bytes to encrypt them into the key ring.

**Step 2: Add exportKey / importTreeKey functions**

```typescript
export async function exportKeyToBase64(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return toBase64(new Uint8Array(raw));
}

export async function importTreeKey(base64Key: string): Promise<CryptoKey> {
  const raw = fromBase64(base64Key);
  return crypto.subtle.importKey(
    "raw", raw, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]
  );
}
```

**Step 3: Add key ring encrypt/decrypt functions**

```typescript
export async function encryptKeyRing(
  keyRing: Record<string, string>,  // treeId -> base64 raw tree key
  masterKey: CryptoKey,
): Promise<string> {
  return encryptForApi(keyRing, masterKey);
}

export async function decryptKeyRing(
  encryptedKeyRing: string,
  masterKey: CryptoKey,
): Promise<Record<string, string>> {
  return decryptFromApi<Record<string, string>>(encryptedKeyRing, masterKey);
}
```

**Step 4: Write tests**

- Test generateTreeKey produces an extractable AES-256-GCM key
- Test exportKeyToBase64 / importTreeKey round-trip
- Test encryptKeyRing / decryptKeyRing round-trip
- Test tree key can encrypt/decrypt data

**Step 5: Run tests and commit**

---

### Task 4: Frontend - Add API functions for key ring

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Step 1: Add API functions**

```typescript
export function getKeyRing(): Promise<{ encrypted_key_ring: string }> {
  return apiFetchWithRetry("/auth/key-ring");
}

export function updateKeyRing(encrypted_key_ring: string): Promise<void> {
  return apiFetchWithRetry("/auth/key-ring", {
    method: "PUT",
    body: { encrypted_key_ring },
  });
}

export function migrateKeys(data: MigrateKeysRequest): Promise<void> {
  return apiFetchWithRetry("/auth/migrate-keys", {
    method: "POST",
    body: data,
  });
}
```

**Step 2: Commit**

---

### Task 5: Frontend - Refactor EncryptionContext for per-tree keys

**Files:**
- Modify: `frontend/src/contexts/EncryptionContext.tsx`
- Modify: `frontend/src/contexts/EncryptionContext.test.tsx` (if exists)

**Step 1: Update interface**

```typescript
interface EncryptionContextValue {
  masterKey: CryptoKey | null;
  treeKeys: Map<string, CryptoKey>;
  passphraseHash: string | null;
  setMasterKey: (key: CryptoKey) => void;
  setTreeKeys: (keys: Map<string, CryptoKey>) => void;
  addTreeKey: (treeId: string, key: CryptoKey) => void;
  removeTreeKey: (treeId: string) => void;
  clearKey: () => void;
  setPassphraseHash: (hash: string) => void;
  verifyPassphrase: (passphrase: string) => Promise<boolean>;
  encrypt: (data: unknown, treeId: string) => Promise<string>;
  decrypt: <T>(encryptedData: string, treeId: string) => Promise<T>;
  // Keep backward-compatible signatures during migration:
  masterEncrypt: (data: unknown) => Promise<string>;
  masterDecrypt: <T>(encryptedData: string) => Promise<T>;
  isMigrated: boolean;
}
```

**Step 2: Update provider implementation**

- Replace single `key` state with `masterKey` and `treeKeys` (Map)
- `encrypt(data, treeId)` looks up tree key; throws if not found
- `decrypt(data, treeId)` looks up tree key; throws if not found
- `masterEncrypt` / `masterDecrypt` use the master key directly (needed during migration)
- `isMigrated` flag indicates whether key ring exists
- `clearKey()` clears both masterKey and treeKeys

**Step 3: Keep backward compatibility**

During migration, `key` (the old single key) = `masterKey`. After migration, tree-scoped operations use tree keys. The `masterEncrypt`/`masterDecrypt` methods are only used during the migration flow itself.

**Step 4: Commit**

---

### Task 6: Frontend - Update useTreeData and useTreeMutations

**Files:**
- Modify: `frontend/src/hooks/useTreeData.ts`
- Modify: `frontend/src/hooks/useTreeMutations.ts`

**Step 1: Update useTreeData**

Change all `decrypt(r.encrypted_data)` calls to `decrypt(r.encrypted_data, treeId)`.

The hook already has `treeId` as a parameter, so this is a mechanical change across all query functions (tree, persons, relationships, events, life events, turning points, classifications, patterns, journal entries).

**Step 2: Update useTreeMutations**

Change all `encrypt(data)` calls to `encrypt(data, treeId)`.

Same mechanical change across all mutation functions.

**Step 3: Update any other consumers**

Search for uses of `encrypt(` and `decrypt(` from the encryption context across the codebase. Update each to pass `treeId`.

Key files to check:
- `frontend/src/pages/TreeListPage.tsx` (encrypts/decrypts tree names; uses tree.id)
- `frontend/src/components/tree/SettingsPanel.tsx` (passphrase change flow)
- Any other component that calls encrypt/decrypt directly

**Step 4: Run all tests, fix any failures from the signature change**

**Step 5: Commit**

---

### Task 7: Frontend - Unlock flow with key ring + migration

**Files:**
- Modify: `frontend/src/pages/UnlockPage.tsx`

**Step 1: Update unlock flow**

After deriving the master key:
1. Try `GET /auth/key-ring`
2. If 200: decrypt key ring, import all tree keys, set in context, set `isMigrated = true`
3. If 404: run migration (Task 8 logic), then proceed

**Step 2: Commit**

---

### Task 8: Frontend - Migration logic

**Files:**
- Create: `frontend/src/hooks/useMigration.ts`
- Create: `frontend/src/hooks/useMigration.test.ts`

**Step 1: Create useMigration hook**

```typescript
export function useMigration() {
  const { masterKey, setTreeKeys, masterEncrypt, masterDecrypt } = useEncryption();

  async function migrate(): Promise<Map<string, CryptoKey>> {
    // 1. Fetch all trees
    const trees = await getTrees();

    // 2. For each tree, generate a tree key and re-encrypt all entities
    const keyRingData: Record<string, string> = {};
    const treeKeys = new Map<string, CryptoKey>();
    const migrationTrees = [];

    for (const tree of trees) {
      const treeKey = await generateTreeKey();
      const rawKeyBase64 = await exportKeyToBase64(treeKey);
      keyRingData[tree.id] = rawKeyBase64;
      treeKeys.set(tree.id, treeKey);

      // Decrypt all entities with master key, re-encrypt with tree key
      const treeData = await decryptFromApi(tree.encrypted_data, masterKey!);
      const newTreeEncrypted = await encryptForApi(treeData, treeKey);

      // ... same for all entity types: persons, relationships, events, etc.

      migrationTrees.push({ tree_id: tree.id, encrypted_data: newTreeEncrypted, persons: [...], ... });
    }

    // 3. Encrypt key ring with master key
    const encryptedKeyRing = await encryptKeyRing(keyRingData, masterKey!);

    // 4. Send to server
    await migrateKeys({ encrypted_key_ring: encryptedKeyRing, trees: migrationTrees });

    return treeKeys;
  }

  return { migrate };
}
```

**Step 2: Write tests**

- Test migration generates unique tree keys for each tree
- Test migration re-encrypts data correctly (decrypt with tree key matches original)
- Test migration produces valid key ring

**Step 3: Commit**

---

### Task 9: Frontend - Simplify passphrase change

**Files:**
- Modify: `frontend/src/components/tree/SettingsPanel.tsx`

**Step 1: Replace bulk re-encryption with key ring update**

The current passphrase change flow (lines ~133-277 in SettingsPanel.tsx) re-encrypts every entity in every tree. After migration, it only needs to:

1. Derive old master key (verify current passphrase)
2. Derive new master key from new passphrase + new salt
3. Decrypt key ring with old master key
4. Re-encrypt key ring with new master key
5. Update key ring on server (`PUT /auth/key-ring`)
6. Update salt on server (`PUT /auth/salt`)
7. Update context with new master key

No tree data is touched because the tree keys haven't changed.

**Step 2: Keep backward compatibility**

If the user hasn't migrated yet (no key ring), fall back to the old re-encryption flow. This handles the edge case of someone who updates their passphrase before their first full unlock (unlikely but possible).

**Step 3: Run tests and commit**

---

### Task 10: Frontend - Export hooks

**Files:**
- Create: `frontend/src/hooks/useExportTree.ts`
- Create: `frontend/src/hooks/useExportTree.test.ts`

**Step 1: Create useExportTree hook**

```typescript
export function useExportTree(treeId: string) {
  const { treeKeys, masterKey } = useEncryption();
  const treeData = useTreeData(treeId);

  async function exportEncrypted() {
    // Get encrypted tree key from key ring
    const treeKey = treeKeys.get(treeId)!;
    const rawKeyBase64 = await exportKeyToBase64(treeKey);
    const encryptedTreeKey = await encryptForApi(rawKeyBase64, masterKey!);

    // Fetch raw encrypted data from API (not decrypted)
    const tree = await getTree(treeId);
    const persons = await getPersons(treeId);
    // ... all entity types

    const exportData = {
      version: 1,
      format: "encrypted",
      exported_at: new Date().toISOString(),
      tree: { id: tree.id, encrypted_data: tree.encrypted_data },
      encrypted_tree_key: encryptedTreeKey,
      persons: persons.map(p => ({ id: p.id, encrypted_data: p.encrypted_data })),
      // ... all entity types with their encrypted data and structural fields (person_ids, source/target)
    };

    downloadJson(exportData, `traumatrees-backup-${slugify(treeName)}-${dateStr}.json`);
  }

  async function exportPlaintext() {
    // Use already-decrypted data from useTreeData
    const exportData = {
      version: 1,
      format: "plaintext",
      exported_at: new Date().toISOString(),
      tree: { name: treeData.treeName },
      persons: Array.from(treeData.persons.values()),
      relationships: Array.from(treeData.relationships.values()),
      // ... all entity types
    };

    downloadJson(exportData, `traumatrees-export-${slugify(treeName)}-${dateStr}.json`);
  }

  return { exportEncrypted, exportPlaintext };
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

**Step 2: Write tests and commit**

---

### Task 11: Frontend - Import hook

**Files:**
- Create: `frontend/src/hooks/useImportTree.ts`
- Create: `frontend/src/hooks/useImportTree.test.ts`

**Step 1: Create useImportTree hook**

```typescript
export function useImportTree() {
  const { masterKey, addTreeKey } = useEncryption();

  async function importTree(file: File): Promise<string> {
    const text = await file.text();
    const data = JSON.parse(text);

    // Validate structure
    if (data.version !== 1 || data.format !== "encrypted") {
      throw new Error("Invalid backup file");
    }

    // Decrypt tree key using master key
    const rawKeyBase64 = await decryptFromApi<string>(data.encrypted_tree_key, masterKey!);
    const treeKey = await importTreeKey(rawKeyBase64);

    // Verify by decrypting tree name
    await decryptFromApi(data.tree.encrypted_data, treeKey);

    // Create tree via API
    const newTree = await createTree({ encrypted_data: data.tree.encrypted_data });

    // Add tree key to key ring
    addTreeKey(newTree.id, treeKey);

    // Import all entities via sync endpoint
    await syncTree(newTree.id, {
      persons_create: data.persons.map(p => ({ ...p })),
      relationships_create: data.relationships.map(r => ({ ...r })),
      events_create: data.events.map(e => ({ ...e })),
      // ... all entity types
    });

    // Update key ring on server
    // ... encrypt updated key ring and PUT /auth/key-ring

    return newTree.id;
  }

  return { importTree };
}
```

**Step 2: Write tests and commit**

---

### Task 12: Frontend - Export UI in settings panel

**Files:**
- Modify: `frontend/src/components/tree/CanvasSettingsContent.tsx` or the tree settings area
- Create: `frontend/src/components/tree/ExportConfirmDialog.tsx`
- Modify translation files

**Step 1: Add export buttons**

Two buttons in the canvas/tree settings panel:
- "Download backup (encrypted)" - calls `exportEncrypted()` directly
- "Download as JSON (unencrypted)" - opens ExportConfirmDialog

**Step 2: Create ExportConfirmDialog**

Modal with warning text and confirm/cancel buttons. On confirm, calls `exportPlaintext()`.

**Step 3: Add translations (en + nl)**

**Step 4: Write component tests and commit**

---

### Task 13: Frontend - Import UI on tree list page

**Files:**
- Modify: `frontend/src/pages/TreeListPage.tsx`
- Create: `frontend/src/components/ImportDialog.tsx`
- Modify translation files

**Step 1: Add import button to toolbar**

New button in the tree list toolbar: "Import backup" (with Upload icon from lucide-react).

**Step 2: Create ImportDialog**

- File picker (accept .json only)
- Validation feedback (parsing, version check, passphrase verification)
- Progress indicator during import
- Success: navigate to imported tree
- Error: show error message

**Step 3: Add translations (en + nl)**

**Step 4: Write component tests and commit**

---

### Task 14: Final verification

**Step 1: Run full test suites**

```bash
docker compose exec api uv run pytest
docker compose exec frontend npx vitest run
```

**Step 2: Run type checks**

```bash
docker compose exec frontend npx tsc --noEmit
docker compose exec api uv run mypy app/
```

**Step 3: Run linting and security checks**

```bash
docker compose exec api uv run ruff check app/
docker compose exec api uv run bandit -r app/
docker compose exec frontend npm audit
```

**Step 4: Manual smoke test**

1. Log in, unlock with passphrase
2. Verify migration happens transparently (existing trees still work)
3. Create a new tree, add some data
4. Export encrypted backup, verify file downloads
5. Export plaintext, verify confirmation dialog and file contents
6. Delete the tree
7. Import the encrypted backup, verify all data restored
8. Change passphrase, verify trees still decrypt (only key ring re-encrypted)
