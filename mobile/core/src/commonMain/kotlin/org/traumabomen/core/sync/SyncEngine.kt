package org.traumabomen.core.sync

import kotlin.uuid.ExperimentalUuidApi
import kotlin.uuid.Uuid
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray

/** One entity as the server returns it on a pull. */
data class ServerEntity(
    val id: String,
    val encryptedData: String,
    val personIds: List<String> = emptyList(),
)

/** The payload for POST /trees/{id}/sync plus the ops it will settle. */
data class SyncPush(val request: JsonObject, val opIds: List<String>)

/**
 * The offline write and reconciliation engine, per the companion design:
 *
 * - Local writes go to the ciphertext mirror immediately and queue in the
 *   outbox. Only the reflective layer is writable ([EntityType.companionWritable]).
 * - Pulls refresh the mirror to server state and reconcile pending ops
 *   first. Creates cannot conflict (fresh UUIDs). An edit whose base no
 *   longer matches the server's content is preserved as a new entity
 *   (keep-both: losing words is the only unacceptable outcome). A delete
 *   whose target changed on the server is dropped (the server edit wins).
 * - [buildPush] renders the outbox as one bulk sync request; [markPushed]
 *   settles it after the server's 200.
 */
class SyncEngine(
    private val mirror: MirrorStore,
    private val outbox: OutboxStore,
    @OptIn(ExperimentalUuidApi::class)
    private val newId: () -> String = { Uuid.random().toString() },
) {
    fun localCreate(
        treeId: String,
        type: EntityType,
        encryptedData: String,
        personIds: List<String> = emptyList(),
    ): String {
        requireWritable(type)
        val id = newId()
        mirror.upsert(MirrorEntry(type, id, treeId, encryptedData, personIds, pendingSync = true))
        outbox.append(
            OutboxOp(newId(), treeId, type, id, OpKind.CREATE, encryptedData, personIds),
        )
        return id
    }

    fun localUpdate(
        type: EntityType,
        id: String,
        encryptedData: String,
        personIds: List<String>? = null,
    ) {
        requireWritable(type)
        val row = requireNotNull(mirror.get(type, id)) { "unknown ${type.syncPrefix} entity $id" }
        val links = personIds ?: row.personIds
        val pending = pendingOpFor(row.treeId, type, id)
        when (pending?.kind) {
            // Not yet on the server: fold the edit into the queued create.
            OpKind.CREATE ->
                outbox.replace(pending.opId, pending.copy(encryptedData = encryptedData, personIds = links))
            // Coalesce repeated edits, keeping the original base for conflict detection.
            OpKind.UPDATE ->
                outbox.replace(pending.opId, pending.copy(encryptedData = encryptedData, personIds = links))
            else ->
                outbox.append(
                    OutboxOp(
                        newId(), row.treeId, type, id, OpKind.UPDATE,
                        encryptedData, links, baseEncryptedData = row.encryptedData,
                    ),
                )
        }
        mirror.upsert(row.copy(encryptedData = encryptedData, personIds = links, pendingSync = true))
    }

    fun localDelete(type: EntityType, id: String) {
        requireWritable(type)
        val row = requireNotNull(mirror.get(type, id)) { "unknown ${type.syncPrefix} entity $id" }
        val pending = pendingOpFor(row.treeId, type, id)
        when (pending?.kind) {
            // Never reached the server: the create and the entity simply vanish.
            OpKind.CREATE -> outbox.remove(listOf(pending.opId))
            OpKind.UPDATE -> {
                outbox.remove(listOf(pending.opId))
                outbox.append(
                    OutboxOp(
                        newId(), row.treeId, type, id, OpKind.DELETE,
                        baseEncryptedData = pending.baseEncryptedData,
                    ),
                )
            }
            else ->
                outbox.append(
                    OutboxOp(
                        newId(), row.treeId, type, id, OpKind.DELETE,
                        baseEncryptedData = row.encryptedData,
                    ),
                )
        }
        mirror.delete(type, id)
    }

    /**
     * Refresh one entity type from a server pull: reconcile pending ops
     * against the server's content, then rebuild the mirror as server state
     * overlaid with what is still queued locally.
     */
    fun applyPull(treeId: String, type: EntityType, serverRows: List<ServerEntity>) {
        val byId = serverRows.associateBy { it.id }
        for (op in outbox.all(treeId).filter { it.entityType == type }) {
            when (op.kind) {
                OpKind.CREATE -> Unit // fresh UUID, cannot conflict
                OpKind.UPDATE -> reconcileUpdate(op, byId[op.entityId])
                OpKind.DELETE -> reconcileDelete(op, byId[op.entityId])
            }
        }
        mirror.replaceAll(
            treeId,
            type,
            serverRows.map { MirrorEntry(type, it.id, treeId, it.encryptedData, it.personIds) },
        )
        // Re-overlay whatever is still queued so the local view shows it.
        for (op in outbox.all(treeId).filter { it.entityType == type }) {
            when (op.kind) {
                OpKind.DELETE -> mirror.delete(type, op.entityId)
                else -> mirror.upsert(
                    MirrorEntry(
                        type, op.entityId, treeId,
                        requireNotNull(op.encryptedData), op.personIds, pendingSync = true,
                    ),
                )
            }
        }
    }

    private fun reconcileUpdate(op: OutboxOp, server: ServerEntity?) {
        val conflicted = server == null || server.encryptedData != op.baseEncryptedData
        if (!conflicted) return
        // Keep-both: the edit becomes a new entity so no words are lost,
        // whether the other device rewrote the entity or deleted it.
        outbox.replace(
            op.opId,
            op.copy(entityId = newId(), kind = OpKind.CREATE, baseEncryptedData = null),
        )
    }

    private fun reconcileDelete(op: OutboxOp, server: ServerEntity?) {
        // Gone already, or edited elsewhere since we decided to delete:
        // either way the delete is dropped (a server edit outranks it).
        if (server == null || server.encryptedData != op.baseEncryptedData) {
            outbox.remove(listOf(op.opId))
        }
    }

    /** Render the queued ops as one bulk sync request body. */
    fun buildPush(treeId: String): SyncPush {
        val ops = outbox.all(treeId)
        val request = buildJsonObject {
            for (type in EntityType.entries) {
                val ofType = ops.filter { it.entityType == type }
                putOps("${type.syncPrefix}_create", ofType.filter { it.kind == OpKind.CREATE }, type)
                putOps("${type.syncPrefix}_update", ofType.filter { it.kind == OpKind.UPDATE }, type)
                val deletes = ofType.filter { it.kind == OpKind.DELETE }
                if (deletes.isNotEmpty()) {
                    putJsonArray("${type.syncPrefix}_delete") {
                        deletes.forEach { add(buildJsonObject { put("id", it.entityId) }) }
                    }
                }
            }
        }
        return SyncPush(request, ops.map { it.opId })
    }

    /** Settle pushed ops after the server accepted the request. */
    fun markPushed(treeId: String, opIds: List<String>) {
        val pushed = outbox.all(treeId).filter { it.opId in opIds.toSet() }
        outbox.remove(opIds)
        for (op in pushed) {
            val row = mirror.get(op.entityType, op.entityId) ?: continue
            if (pendingOpFor(treeId, op.entityType, op.entityId) == null) {
                mirror.upsert(row.copy(pendingSync = false))
            }
        }
    }

    fun pendingCount(treeId: String): Int = outbox.all(treeId).size

    private fun kotlinx.serialization.json.JsonObjectBuilder.putOps(
        field: String,
        ops: List<OutboxOp>,
        type: EntityType,
    ) {
        if (ops.isEmpty()) return
        putJsonArray(field) {
            for (op in ops) {
                add(
                    buildJsonObject {
                        put("id", op.entityId)
                        put("encrypted_data", requireNotNull(op.encryptedData))
                        if (type.personLinked) {
                            put("person_ids", buildJsonArray { op.personIds.forEach { add(kotlinx.serialization.json.JsonPrimitive(it)) } })
                        }
                    },
                )
            }
        }
    }

    private fun pendingOpFor(treeId: String, type: EntityType, id: String): OutboxOp? =
        outbox.all(treeId).lastOrNull { it.entityType == type && it.entityId == id }

    private fun requireWritable(type: EntityType) {
        require(type.companionWritable) {
            "${type.syncPrefix} is read-only on the companion; edit it on the desktop"
        }
    }
}
