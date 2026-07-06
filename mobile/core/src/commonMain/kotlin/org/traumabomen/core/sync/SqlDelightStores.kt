package org.traumabomen.core.sync

import kotlinx.serialization.json.Json
import org.traumabomen.core.db.CoreDatabase
import org.traumabomen.core.db.MirrorRow as DbMirrorRow
import org.traumabomen.core.db.OutboxOp as DbOutboxOp

/**
 * SQLDelight-backed stores: the on-device persistence for the ciphertext
 * mirror and the offline outbox. Everything stored is ciphertext or
 * structural metadata (ids, type names, order), so the database at rest
 * holds nothing the server does not. The platform layers add their own
 * file protection on top (NSFileProtectionComplete on iOS).
 */

private val json = Json

private fun encodeIds(ids: List<String>): String = json.encodeToString(ids)

private fun decodeIds(s: String): List<String> = json.decodeFromString(s)

class SqlDelightMirrorStore(private val db: CoreDatabase) : MirrorStore {
    override fun get(type: EntityType, id: String): MirrorRow? =
        db.mirrorQueries.get(type.name, id).executeAsOneOrNull()?.toModel()

    override fun list(treeId: String, type: EntityType): List<MirrorRow> =
        db.mirrorQueries.listByTreeAndType(treeId, type.name).executeAsList().map { it.toModel() }

    override fun upsert(row: MirrorRow) {
        db.mirrorQueries.upsert(
            entityType = row.entityType.name,
            id = row.id,
            treeId = row.treeId,
            encryptedData = row.encryptedData,
            personIds = encodeIds(row.personIds),
            pendingSync = if (row.pendingSync) 1 else 0,
        )
    }

    override fun delete(type: EntityType, id: String) {
        db.mirrorQueries.delete(type.name, id)
    }

    override fun replaceAll(treeId: String, type: EntityType, rows: List<MirrorRow>) {
        db.mirrorQueries.transaction {
            db.mirrorQueries.deleteByTreeAndType(treeId, type.name)
            rows.forEach { upsert(it) }
        }
    }

    private fun DbMirrorRow.toModel(): MirrorRow =
        MirrorRow(
            entityType = EntityType.valueOf(entityType),
            id = id,
            treeId = treeId,
            encryptedData = encryptedData,
            personIds = decodeIds(personIds),
            pendingSync = pendingSync != 0L,
        )
}

class SqlDelightOutboxStore(private val db: CoreDatabase) : OutboxStore {
    override fun all(treeId: String): List<OutboxOp> =
        db.outboxQueries.allByTree(treeId).executeAsList().map { it.toModel() }

    override fun append(op: OutboxOp) {
        db.outboxQueries.append(
            opId = op.opId,
            treeId = op.treeId,
            entityType = op.entityType.name,
            entityId = op.entityId,
            kind = op.kind.name,
            encryptedData = op.encryptedData,
            personIds = encodeIds(op.personIds),
            baseEncryptedData = op.baseEncryptedData,
        )
    }

    override fun replace(opId: String, op: OutboxOp) {
        db.outboxQueries.transaction {
            require(db.outboxQueries.countByOpId(opId).executeAsOne() > 0L) { "unknown op $opId" }
            db.outboxQueries.replaceByOpId(
                entityType = op.entityType.name,
                entityId = op.entityId,
                kind = op.kind.name,
                encryptedData = op.encryptedData,
                personIds = encodeIds(op.personIds),
                baseEncryptedData = op.baseEncryptedData,
                opId = opId,
            )
        }
    }

    override fun remove(opIds: Collection<String>) {
        if (opIds.isEmpty()) return
        db.outboxQueries.removeByOpIds(opIds)
    }

    private fun DbOutboxOp.toModel(): OutboxOp =
        OutboxOp(
            opId = opId,
            treeId = treeId,
            entityType = EntityType.valueOf(entityType),
            entityId = entityId,
            kind = OpKind.valueOf(kind),
            encryptedData = encryptedData,
            personIds = decodeIds(personIds),
            baseEncryptedData = baseEncryptedData,
        )
}
