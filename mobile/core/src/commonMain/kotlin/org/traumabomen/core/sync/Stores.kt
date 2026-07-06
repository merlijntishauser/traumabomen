package org.traumabomen.core.sync

import kotlinx.serialization.Serializable

/**
 * One row of the ciphertext mirror: exactly what the server holds for the
 * entity, plus a pending flag while a local write has not been pushed.
 * Nothing here is plaintext; person ids are structural metadata the server
 * stores alongside the blob.
 */
@Serializable
data class MirrorEntry(
    val entityType: EntityType,
    val id: String,
    val treeId: String,
    val encryptedData: String,
    val personIds: List<String> = emptyList(),
    val pendingSync: Boolean = false,
)

enum class OpKind { CREATE, UPDATE, DELETE }

/**
 * One queued offline write. [baseEncryptedData] is the server-known content
 * the operation was based on; the pull reconciliation compares it against
 * the server's current content to detect that another device wrote in the
 * meantime. Content comparison instead of timestamps: no clock skew, and a
 * byte-identical blob is by definition not a conflict.
 */
@Serializable
data class OutboxOp(
    val opId: String,
    val treeId: String,
    val entityType: EntityType,
    val entityId: String,
    val kind: OpKind,
    val encryptedData: String? = null,
    val personIds: List<String> = emptyList(),
    val baseEncryptedData: String? = null,
)

/** Storage seam; SQLDelight implements both on device, in-memory in tests. */
interface MirrorStore {
    fun get(type: EntityType, id: String): MirrorEntry?

    fun list(treeId: String, type: EntityType): List<MirrorEntry>

    fun upsert(row: MirrorEntry)

    fun delete(type: EntityType, id: String)

    /** Replace all rows of one type for a tree (the pull refresh). */
    fun replaceAll(treeId: String, type: EntityType, rows: List<MirrorEntry>)
}

interface OutboxStore {
    /** All queued ops for a tree, in insertion order. */
    fun all(treeId: String): List<OutboxOp>

    fun append(op: OutboxOp)

    fun replace(opId: String, op: OutboxOp)

    fun remove(opIds: Collection<String>)
}

class InMemoryMirrorStore : MirrorStore {
    private val rows = LinkedHashMap<Pair<EntityType, String>, MirrorEntry>()

    override fun get(type: EntityType, id: String): MirrorEntry? = rows[type to id]

    override fun list(treeId: String, type: EntityType): List<MirrorEntry> =
        rows.values.filter { it.treeId == treeId && it.entityType == type }

    override fun upsert(row: MirrorEntry) {
        rows[row.entityType to row.id] = row
    }

    override fun delete(type: EntityType, id: String) {
        rows.remove(type to id)
    }

    override fun replaceAll(treeId: String, type: EntityType, newRows: List<MirrorEntry>) {
        rows.keys.removeAll { (t, id) -> t == type && rows[t to id]?.treeId == treeId }
        newRows.forEach { upsert(it) }
    }
}

class InMemoryOutboxStore : OutboxStore {
    private val ops = LinkedHashMap<String, OutboxOp>()

    override fun all(treeId: String): List<OutboxOp> = ops.values.filter { it.treeId == treeId }

    override fun append(op: OutboxOp) {
        ops[op.opId] = op
    }

    override fun replace(opId: String, op: OutboxOp) {
        require(ops.containsKey(opId)) { "unknown op $opId" }
        ops[opId] = op
    }

    override fun remove(opIds: Collection<String>) {
        opIds.forEach { ops.remove(it) }
    }
}
