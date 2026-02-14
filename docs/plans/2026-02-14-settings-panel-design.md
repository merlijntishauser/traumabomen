# Settings Panel Design

## Summary

Consolidate the toolbar by moving theme toggle and language selector into a unified "Settings" panel. Add an Account tab with password change, passphrase change, and account deletion.

## Toolbar Changes

The gear icon stays in its current position. Its label changes from "Canvas settings" to "Settings". The theme toggle (sun/moon icon) and language button (EN/NL) are removed from the toolbar -- they move into the settings panel.

## Panel Structure

The panel opens as a dropdown from the gear icon, same positioning pattern as the current `CanvasSettingsPanel`. Width increases to ~320px to accommodate form fields. Two tabs at the top: **Canvas** and **Account**.

### Canvas Tab

Contains everything the current panel has, plus the two relocated controls:

- Show grid (checkbox)
- Snap to grid (checkbox)
- Show markers (checkbox)
- Show minimap (checkbox)
- Edge style (radio: curved / elbows / straight)
- Theme (toggle: light / dark)
- Language (toggle: EN / NL)

### Account Tab

Three sections separated by dividers.

**Change password**

- Current password field
- New password field
- Confirm new password field
- Save button

On submit: `PUT /auth/password` with `{ current_password, new_password }`. Backend verifies current password, hashes and stores the new one. Existing JWT stays valid.

**Change passphrase**

Warning text: "Changing your passphrase will re-encrypt all your data. Do not close the browser during this process."

- Current passphrase field
- New passphrase field
- Confirm new passphrase field
- Save button with progress indicator during re-encryption

Flow:

1. Derive old key from current passphrase + stored salt
2. Fetch all encrypted entities (persons, relationships, events, life events) for all trees
3. Decrypt each blob with old key, re-encrypt with new key derived from new passphrase + new salt
4. Bulk sync re-encrypted blobs per tree
5. `PUT /auth/salt` to update the stored salt
6. Replace old key with new key in memory

If anything fails, old data remains intact (sync is transactional).

**Delete account**

Red danger zone styling.

1. "Delete my account" button reveals confirmation area
2. Warning text (red): "This action is permanent. Your account and all your data will be permanently deleted and cannot be restored."
3. Text input: user must type "DELETE" to enable the confirm button
4. Password field for identity verification
5. "Permanently delete my account" button (red, disabled until both fields are filled correctly)

On confirm: `DELETE /auth/account` with `{ password }`. Backend verifies password, hard-deletes user and all owned data in a single transaction. No soft-delete, no recovery. Frontend clears tokens and redirects to login.

## Backend Endpoints

Three new endpoints in `auth.py`:

| Method | Path | Body | Response |
|--------|------|------|----------|
| PUT | `/auth/password` | `{ current_password, new_password }` | 200 |
| PUT | `/auth/salt` | `{ encryption_salt }` | 200 |
| DELETE | `/auth/account` | `{ password }` | 204 |

All require authentication. The delete endpoint cascade-deletes user and all owned trees (persons, relationships, events, life events) in a single transaction.

## i18n

New keys under `settings.*` and `account.*` namespaces in both `en/translation.json` and `nl/translation.json`.

## No Changes Needed

- Encryption module (`crypto.ts`) -- already has `deriveKey`, `encrypt`, `decrypt`
- Bulk sync endpoint -- already supports batch updates per tree
- Database models -- cascading deletes already configured via `ondelete="CASCADE"`
