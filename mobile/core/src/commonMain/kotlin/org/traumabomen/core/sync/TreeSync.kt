package org.traumabomen.core.sync

import org.traumabomen.core.api.ApiClient

/**
 * The app-facing sync facade: local writes queue in the durable outbox,
 * pushes drain it through the bulk sync endpoint, and pulls reconcile
 * (keep-both) before reading the local view from the ciphertext mirror.
 * Offline pushes and pulls fail soft; the mirror and the queue carry the
 * truth until the network returns.
 */
class TreeSync(db: org.traumabomen.core.db.CoreDatabase, private val api: ApiClient) {
    private val database = db
    private val mirror = SqlDelightMirrorStore(db)
    private val outbox = SqlDelightOutboxStore(db)
    private val engine = SyncEngine(mirror, outbox)

    /** Wipe all local ciphertext and the queue (on logout / account switch). */
    fun wipe() {
        database.mirrorQueries.deleteAll()
        database.outboxQueries.deleteAll()
    }

    fun pendingCount(treeId: String): Int = engine.pendingCount(treeId)

    // --- Generic writes for the reflective layer (trauma/life events, turning
    // points, classifications, journal). The engine enforces companionWritable.

    /** Queue a new encrypted entity of [type]; visible locally immediately. */
    fun createEntity(
        treeId: String,
        type: EntityType,
        encryptedData: String,
        personIds: List<String> = emptyList(),
    ): String = engine.localCreate(treeId, type, encryptedData, personIds)

    /** Queue an edit; passing null person ids keeps the existing links. */
    fun updateEntity(
        type: EntityType,
        id: String,
        encryptedData: String,
        personIds: List<String>? = null,
    ) = engine.localUpdate(type, id, encryptedData, personIds)

    /** Queue a deletion of an entity of [type]. */
    fun deleteEntity(type: EntityType, id: String) =
        engine.localDelete(type, id)

    // --- Journal convenience wrappers (unchanged signatures for the composer).

    /** Queue a new encrypted journal entry; visible locally immediately. */
    fun createLocal(treeId: String, encryptedData: String): String =
        createEntity(treeId, EntityType.JOURNAL_ENTRIES, encryptedData)

    /** Queue an edit to an existing journal entry. */
    fun updateLocal(id: String, encryptedData: String) =
        updateEntity(EntityType.JOURNAL_ENTRIES, id, encryptedData)

    /** Queue a deletion of a journal entry. */
    fun deleteLocal(id: String) =
        deleteEntity(EntityType.JOURNAL_ENTRIES, id)

    /** Push queued ops; returns true when the queue drained. */
    @Throws(Exception::class)
    suspend fun push(treeId: String): Boolean {
        val push = engine.buildPush(treeId)
        if (push.opIds.isEmpty()) return true
        return try {
            api.pushSync(treeId, push.request)
            engine.markPushed(treeId, push.opIds)
            true
        } catch (_: Exception) {
            false
        }
    }

    /**
     * Pull one entity type from the server, reconcile pending ops, and
     * return the local view. When offline, the mirror serves what it has.
     */
    @Throws(Exception::class)
    suspend fun pull(treeId: String, type: EntityType): List<MirrorEntry> {
        try {
            val server = api.pullEntities(treeId, type)
            engine.applyPull(treeId, type, server)
        } catch (_: Exception) {
            // Offline; fall through to the mirror.
        }
        return mirror.list(treeId, type)
    }

    @Throws(Exception::class)
    suspend fun pullJournal(treeId: String): List<MirrorEntry> = pull(treeId, EntityType.JOURNAL_ENTRIES)
}
