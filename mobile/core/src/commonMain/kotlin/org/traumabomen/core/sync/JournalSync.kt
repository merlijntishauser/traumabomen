package org.traumabomen.core.sync

import org.traumabomen.core.api.ApiClient

/**
 * The app-facing sync facade for the journal: local writes queue in the
 * durable outbox, pushes drain it through the bulk sync endpoint, and pulls
 * reconcile (keep-both) before reading the local view from the ciphertext
 * mirror. Offline pushes and pulls fail soft; the mirror and the queue
 * carry the truth until the network returns.
 */
class JournalSync(db: org.traumabomen.core.db.CoreDatabase, private val api: ApiClient) {
    private val mirror = SqlDelightMirrorStore(db)
    private val outbox = SqlDelightOutboxStore(db)
    private val engine = SyncEngine(mirror, outbox)

    fun pendingCount(treeId: String): Int = engine.pendingCount(treeId)

    /** Queue a new encrypted entry; visible locally immediately. */
    fun createLocal(treeId: String, encryptedData: String): String =
        engine.localCreate(treeId, EntityType.JOURNAL_ENTRIES, encryptedData)

    /** Push queued ops; returns true when the queue drained. */
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
     * Pull the server's journal, reconcile pending ops, and return the
     * local view. When offline, the mirror serves what it has.
     */
    suspend fun pullJournal(treeId: String): List<MirrorEntry> {
        try {
            val server = api.pullEntities(treeId, EntityType.JOURNAL_ENTRIES)
            engine.applyPull(treeId, EntityType.JOURNAL_ENTRIES, server)
        } catch (_: Exception) {
            // Offline; fall through to the mirror.
        }
        return mirror.list(treeId, EntityType.JOURNAL_ENTRIES)
    }
}
