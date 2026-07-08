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

    /** Queue a new encrypted entry; visible locally immediately. */
    fun createLocal(treeId: String, encryptedData: String): String =
        engine.localCreate(treeId, EntityType.JOURNAL_ENTRIES, encryptedData)

    /** Queue an edit to an existing entry. */
    fun updateLocal(id: String, encryptedData: String) =
        engine.localUpdate(EntityType.JOURNAL_ENTRIES, id, encryptedData)

    /** Queue a deletion of an entry. */
    fun deleteLocal(id: String) =
        engine.localDelete(EntityType.JOURNAL_ENTRIES, id)

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
