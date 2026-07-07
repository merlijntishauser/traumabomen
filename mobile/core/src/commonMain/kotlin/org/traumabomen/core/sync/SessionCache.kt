package org.traumabomen.core.sync

import org.traumabomen.core.db.CoreDatabase

/**
 * Locally cached unlock inputs so the app opens offline: the salt, the
 * passphrase hint, and the encrypted key ring. All three are exactly what
 * the server serves before the passphrase proves anything, so caching them
 * changes no trust boundary; the ring only yields keys to a passphrase (or
 * the Enclave-held master key) that was correct all along.
 */
class SessionCache(private val db: CoreDatabase) {
    var saltBase64: String?
        get() = get("salt")
        set(value) = put("salt", value)

    var passphraseHint: String?
        get() = get("passphrase_hint")
        set(value) = put("passphrase_hint", value)

    var encryptedKeyRing: String?
        get() = get("encrypted_key_ring")
        set(value) = put("encrypted_key_ring", value)

    /** Cached tree list (ciphertext blobs) and the last selected tree id. */
    var treeList: String?
        get() = get("tree_list")
        set(value) = put("tree_list", value)

    var selectedTreeId: String?
        get() = get("selected_tree_id")
        set(value) = put("selected_tree_id", value)

    fun clear() {
        listOf("salt", "passphrase_hint", "encrypted_key_ring", "tree_list", "selected_tree_id").forEach {
            db.kvQueries.remove(it)
        }
    }

    private fun get(key: String): String? =
        db.kvQueries.get(key).executeAsOneOrNull()

    private fun put(key: String, value: String?) {
        if (value == null) db.kvQueries.remove(key) else db.kvQueries.put(key, value)
    }
}
