package org.traumabomen.core.sync

import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue
import org.traumabomen.core.db.CoreDatabase

private const val TREE = "tree-1"

class SqlDelightStoresTest {
    private fun openDb(url: String = JdbcSqliteDriver.IN_MEMORY): CoreDatabase {
        val driver = JdbcSqliteDriver(url)
        CoreDatabase.Schema.create(driver)
        return CoreDatabase(driver)
    }

    private fun engineOn(db: CoreDatabase): SyncEngine {
        var counter = 0
        return SyncEngine(SqlDelightMirrorStore(db), SqlDelightOutboxStore(db)) { "sql-${++counter}" }
    }

    @Test
    fun engineRunsEndToEndOnSqlStores() {
        val db = openDb()
        val engine = engineOn(db)
        val mirror = SqlDelightMirrorStore(db)

        val id = engine.localCreate(TREE, EntityType.JOURNAL_ENTRIES, "draft-1")
        engine.localUpdate(EntityType.JOURNAL_ENTRIES, id, "draft-2")
        assertEquals("draft-2", mirror.get(EntityType.JOURNAL_ENTRIES, id)!!.encryptedData)
        assertEquals(1, engine.pendingCount(TREE))

        // Keep-both conflict path, exercised through SQL-backed stores.
        mirror.upsert(MirrorEntry(EntityType.JOURNAL_ENTRIES, "srv-1", TREE, "v1"))
        engine.localUpdate(EntityType.JOURNAL_ENTRIES, "srv-1", "mine")
        engine.applyPull(TREE, EntityType.JOURNAL_ENTRIES, listOf(ServerEntity("srv-1", "theirs")))

        val rows = mirror.list(TREE, EntityType.JOURNAL_ENTRIES)
        assertEquals(setOf("theirs", "mine", "draft-2"), rows.map { it.encryptedData }.toSet())
    }

    @Test
    fun outboxSurvivesAReconnect() {
        val file = Files.createTempFile("traumabomen-core", ".db")
        val url = "jdbc:sqlite:${file.toAbsolutePath()}"
        try {
            engineOn(openDb(url)).localCreate(TREE, EntityType.TRAUMA_EVENTS, "offline-blob", listOf("p1"))

            // A fresh connection sees the queued op and the mirror row: the
            // design's queue-survives-restarts requirement.
            val reopened = CoreDatabase(JdbcSqliteDriver(url))
            val outbox = SqlDelightOutboxStore(reopened)
            val op = outbox.all(TREE).single()
            assertEquals(OpKind.CREATE, op.kind)
            assertEquals("offline-blob", op.encryptedData)
            assertEquals(listOf("p1"), op.personIds)
            assertTrue(SqlDelightMirrorStore(reopened).get(EntityType.TRAUMA_EVENTS, op.entityId)!!.pendingSync)
        } finally {
            Files.deleteIfExists(file)
        }
    }

    @Test
    fun replaceKeepsInsertionOrder() {
        val db = openDb()
        val outbox = SqlDelightOutboxStore(db)
        outbox.append(OutboxOp("op-1", TREE, EntityType.JOURNAL_ENTRIES, "e1", OpKind.CREATE, "a"))
        outbox.append(OutboxOp("op-2", TREE, EntityType.JOURNAL_ENTRIES, "e2", OpKind.CREATE, "b"))

        // Reconciliation rewrites the first op; it must not move to the back.
        outbox.replace(
            "op-1",
            OutboxOp("op-1", TREE, EntityType.JOURNAL_ENTRIES, "e1-new", OpKind.CREATE, "a2"),
        )
        assertEquals(listOf("op-1", "op-2"), outbox.all(TREE).map { it.opId })
        assertEquals("e1-new", outbox.all(TREE).first().entityId)
    }

    @Test
    fun replaceOfUnknownOpFails() {
        val outbox = SqlDelightOutboxStore(openDb())
        assertFailsWith<IllegalArgumentException> {
            outbox.replace("ghost", OutboxOp("ghost", TREE, EntityType.JOURNAL_ENTRIES, "e", OpKind.CREATE, "x"))
        }
    }

    @Test
    fun removeDeletesOnlyTheGivenOps() {
        val db = openDb()
        val outbox = SqlDelightOutboxStore(db)
        outbox.append(OutboxOp("op-1", TREE, EntityType.JOURNAL_ENTRIES, "e1", OpKind.CREATE, "a"))
        outbox.append(OutboxOp("op-2", TREE, EntityType.JOURNAL_ENTRIES, "e2", OpKind.CREATE, "b"))
        outbox.remove(listOf("op-1"))
        assertEquals(listOf("op-2"), outbox.all(TREE).map { it.opId })
    }

    @Test
    fun replaceAllIsScopedToTreeAndType() {
        val db = openDb()
        val mirror = SqlDelightMirrorStore(db)
        mirror.upsert(MirrorEntry(EntityType.PERSONS, "p1", TREE, "person-blob"))
        mirror.upsert(MirrorEntry(EntityType.PERSONS, "p-other", "tree-2", "other-tree-blob"))
        mirror.upsert(MirrorEntry(EntityType.JOURNAL_ENTRIES, "j1", TREE, "journal-blob"))

        mirror.replaceAll(TREE, EntityType.PERSONS, listOf(MirrorEntry(EntityType.PERSONS, "p2", TREE, "fresh")))

        assertNull(mirror.get(EntityType.PERSONS, "p1"))
        assertEquals("fresh", mirror.get(EntityType.PERSONS, "p2")!!.encryptedData)
        assertEquals("other-tree-blob", mirror.get(EntityType.PERSONS, "p-other")!!.encryptedData)
        assertEquals("journal-blob", mirror.get(EntityType.JOURNAL_ENTRIES, "j1")!!.encryptedData)
    }
}
