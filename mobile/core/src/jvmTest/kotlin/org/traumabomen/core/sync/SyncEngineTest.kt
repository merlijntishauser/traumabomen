package org.traumabomen.core.sync

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

private const val TREE = "tree-1"

class SyncEngineTest {
    private val mirror = InMemoryMirrorStore()
    private val outbox = InMemoryOutboxStore()
    private var counter = 0
    private val engine = SyncEngine(mirror, outbox) { "gen-${++counter}" }

    private fun seedServerRow(
        type: EntityType = EntityType.JOURNAL_ENTRIES,
        id: String = "server-1",
        data: String = "blob-v1",
    ) {
        mirror.upsert(MirrorEntry(type, id, TREE, data))
    }

    @Test
    fun offlineCreateLandsInMirrorAndOutbox() {
        val id = engine.localCreate(TREE, EntityType.TRAUMA_EVENTS, "blob-a", listOf("p1", "p2"))

        val row = mirror.get(EntityType.TRAUMA_EVENTS, id)!!
        assertTrue(row.pendingSync)
        assertEquals("blob-a", row.encryptedData)
        assertEquals(1, engine.pendingCount(TREE))

        val push = engine.buildPush(TREE)
        val creates = push.request["events_create"]!!.jsonArray
        assertEquals(1, creates.size)
        assertEquals(id, creates[0].jsonObject["id"]!!.jsonPrimitive.content)
        assertEquals("blob-a", creates[0].jsonObject["encrypted_data"]!!.jsonPrimitive.content)
        assertEquals(2, creates[0].jsonObject["person_ids"]!!.jsonArray.size)
        assertNull(push.request["events_update"])
    }

    @Test
    fun journalCreateCarriesNoPersonIds() {
        engine.localCreate(TREE, EntityType.JOURNAL_ENTRIES, "blob-j")
        val creates = engine.buildPush(TREE).request["journal_entries_create"]!!.jsonArray
        assertNull(creates[0].jsonObject["person_ids"])
    }

    @Test
    fun editingAPendingCreateCoalescesIntoOneCreate() {
        val id = engine.localCreate(TREE, EntityType.JOURNAL_ENTRIES, "draft-1")
        engine.localUpdate(EntityType.JOURNAL_ENTRIES, id, "draft-2")

        assertEquals(1, engine.pendingCount(TREE))
        val creates = engine.buildPush(TREE).request["journal_entries_create"]!!.jsonArray
        assertEquals("draft-2", creates[0].jsonObject["encrypted_data"]!!.jsonPrimitive.content)
    }

    @Test
    fun deletingAPendingCreateVanishesEntirely() {
        val id = engine.localCreate(TREE, EntityType.JOURNAL_ENTRIES, "draft")
        engine.localDelete(EntityType.JOURNAL_ENTRIES, id)

        assertEquals(0, engine.pendingCount(TREE))
        assertNull(mirror.get(EntityType.JOURNAL_ENTRIES, id))
        assertTrue(engine.buildPush(TREE).request.isEmpty())
    }

    @Test
    fun updateOfServerEntityRecordsItsBase() {
        seedServerRow(data = "blob-v1")
        engine.localUpdate(EntityType.JOURNAL_ENTRIES, "server-1", "blob-v2")

        val updates = engine.buildPush(TREE).request["journal_entries_update"]!!.jsonArray
        assertEquals("blob-v2", updates[0].jsonObject["encrypted_data"]!!.jsonPrimitive.content)
        assertEquals("blob-v1", outbox.all(TREE).single().baseEncryptedData)
    }

    @Test
    fun repeatedEditsCoalesceKeepingTheOriginalBase() {
        seedServerRow(data = "blob-v1")
        engine.localUpdate(EntityType.JOURNAL_ENTRIES, "server-1", "blob-v2")
        engine.localUpdate(EntityType.JOURNAL_ENTRIES, "server-1", "blob-v3")

        assertEquals(1, engine.pendingCount(TREE))
        val op = outbox.all(TREE).single()
        assertEquals("blob-v3", op.encryptedData)
        assertEquals("blob-v1", op.baseEncryptedData)
    }

    @Test
    fun pullWithUnchangedServerContentKeepsTheEditAsAnUpdate() {
        seedServerRow(data = "blob-v1")
        engine.localUpdate(EntityType.JOURNAL_ENTRIES, "server-1", "blob-v2")

        engine.applyPull(TREE, EntityType.JOURNAL_ENTRIES, listOf(ServerEntity("server-1", "blob-v1")))

        val op = outbox.all(TREE).single()
        assertEquals(OpKind.UPDATE, op.kind)
        // The local view still shows the pending edit.
        assertEquals("blob-v2", mirror.get(EntityType.JOURNAL_ENTRIES, "server-1")!!.encryptedData)
    }

    @Test
    fun conflictingEditIsPreservedAsANewEntity() {
        seedServerRow(data = "blob-v1")
        engine.localUpdate(EntityType.JOURNAL_ENTRIES, "server-1", "blob-mine")

        // Another device rewrote the entry before our push.
        engine.applyPull(TREE, EntityType.JOURNAL_ENTRIES, listOf(ServerEntity("server-1", "blob-theirs")))

        val op = outbox.all(TREE).single()
        assertEquals(OpKind.CREATE, op.kind)
        assertEquals("blob-mine", op.encryptedData)
        assertTrue(op.entityId != "server-1")

        // Both versions visible: theirs under the original id, ours as new.
        assertEquals("blob-theirs", mirror.get(EntityType.JOURNAL_ENTRIES, "server-1")!!.encryptedData)
        assertEquals("blob-mine", mirror.get(EntityType.JOURNAL_ENTRIES, op.entityId)!!.encryptedData)
    }

    @Test
    fun editOfAnEntityDeletedElsewhereIsPreservedAsANewEntity() {
        seedServerRow(data = "blob-v1")
        engine.localUpdate(EntityType.JOURNAL_ENTRIES, "server-1", "blob-mine")

        engine.applyPull(TREE, EntityType.JOURNAL_ENTRIES, emptyList())

        val op = outbox.all(TREE).single()
        assertEquals(OpKind.CREATE, op.kind)
        assertEquals("blob-mine", mirror.get(EntityType.JOURNAL_ENTRIES, op.entityId)!!.encryptedData)
        assertNull(mirror.get(EntityType.JOURNAL_ENTRIES, "server-1"))
    }

    @Test
    fun deleteLosesToAServerEdit() {
        seedServerRow(data = "blob-v1")
        engine.localDelete(EntityType.JOURNAL_ENTRIES, "server-1")

        engine.applyPull(TREE, EntityType.JOURNAL_ENTRIES, listOf(ServerEntity("server-1", "blob-theirs")))

        assertEquals(0, engine.pendingCount(TREE))
        assertEquals("blob-theirs", mirror.get(EntityType.JOURNAL_ENTRIES, "server-1")!!.encryptedData)
    }

    @Test
    fun deleteOfAnUnchangedEntitySurvivesThePull() {
        seedServerRow(data = "blob-v1")
        engine.localDelete(EntityType.JOURNAL_ENTRIES, "server-1")

        engine.applyPull(TREE, EntityType.JOURNAL_ENTRIES, listOf(ServerEntity("server-1", "blob-v1")))

        assertEquals(1, engine.pendingCount(TREE))
        assertNull(mirror.get(EntityType.JOURNAL_ENTRIES, "server-1"))
        val deletes = engine.buildPush(TREE).request["journal_entries_delete"]!!.jsonArray
        assertEquals("server-1", deletes[0].jsonObject["id"]!!.jsonPrimitive.content)
    }

    @Test
    fun markPushedSettlesTheQueueAndFutureEditsUseThePushedBase() {
        seedServerRow(data = "blob-v1")
        engine.localUpdate(EntityType.JOURNAL_ENTRIES, "server-1", "blob-v2")

        val push = engine.buildPush(TREE)
        engine.markPushed(TREE, push.opIds)

        assertEquals(0, engine.pendingCount(TREE))
        assertFalse(mirror.get(EntityType.JOURNAL_ENTRIES, "server-1")!!.pendingSync)

        // A later edit bases itself on the content we pushed, so the next
        // pull (returning exactly that content) sees no false conflict.
        engine.localUpdate(EntityType.JOURNAL_ENTRIES, "server-1", "blob-v3")
        engine.applyPull(TREE, EntityType.JOURNAL_ENTRIES, listOf(ServerEntity("server-1", "blob-v2")))
        assertEquals(OpKind.UPDATE, outbox.all(TREE).single().kind)
    }

    @Test
    fun pullRefreshesReadOnlyEntities() {
        engine.applyPull(
            TREE,
            EntityType.PERSONS,
            listOf(ServerEntity("p1", "person-blob", emptyList())),
        )
        assertEquals("person-blob", mirror.get(EntityType.PERSONS, "p1")!!.encryptedData)
    }

    @Test
    fun readOnlyTypesRefuseLocalWrites() {
        assertFailsWith<IllegalArgumentException> {
            engine.localCreate(TREE, EntityType.PERSONS, "blob")
        }
        assertFailsWith<IllegalArgumentException> {
            engine.localCreate(TREE, EntityType.PATTERNS, "blob")
        }
    }
}
