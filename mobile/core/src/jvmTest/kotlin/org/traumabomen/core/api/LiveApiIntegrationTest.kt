package org.traumabomen.core.api

import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import java.security.SecureRandom
import kotlin.io.encoding.Base64
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.jsonObject
import org.traumabomen.core.crypto.TraumaCrypto
import org.traumabomen.core.sync.EntityType
import org.traumabomen.core.sync.InMemoryMirrorStore
import org.traumabomen.core.sync.InMemoryOutboxStore
import org.traumabomen.core.sync.SyncEngine

/**
 * The whole zero-knowledge loop against a real running backend, using only
 * core code: register, login, derive the master key, wrap a fresh tree key
 * into the key ring, write a journal entry offline through the sync engine,
 * push it via bulk sync, pull it back, and decrypt it.
 *
 * Opt-in: set TRAUMABOMEN_LIVE_API (e.g. http://localhost:8000, the compose
 * dev stack) to run; skipped otherwise so CI needs no backend. Accounts use
 * the e2e- prefix, which POST /test/reset cleans up.
 */
class LiveApiIntegrationTest {
    private val baseUrl: String? = System.getenv("TRAUMABOMEN_LIVE_API")

    @Test
    fun fullZeroKnowledgeLoopAgainstTheRealBackend() {
        val base = baseUrl ?: run {
            println("skipped: TRAUMABOMEN_LIVE_API not set")
            return
        }

        runBlocking {
            val api = ApiClient(base, HttpClient(CIO))
            val random = SecureRandom()

            // Register and log in, exactly as a fresh device would.
            val email = "e2e-kmp-${System.nanoTime()}@example.org"
            val salt = Base64.encode(ByteArray(16).also(random::nextBytes))
            api.register(email, "kmp-spike-Password1", salt)
            val saltInfo = api.login(email, "kmp-spike-Password1")
            assertEquals(salt, saltInfo.encryptionSalt)

            // Derive the master key (BouncyCastle Argon2id) and set up a tree
            // with its wrapped key, as the web client does at registration.
            val masterKey = TraumaCrypto.deriveMasterKey("stille-boom-1938", salt)
            val treeKeyRaw = ByteArray(32).also(random::nextBytes)
            val treeKeyB64 = Base64.encode(treeKeyRaw)
            val treeKey = TraumaCrypto.importTreeKey(treeKeyB64)
            val treeId = api.createTree(TraumaCrypto.encryptForApi(mapOf("name" to "Integratieboom"), treeKey))
            api.putKeyRing(TraumaCrypto.encryptKeyRing(mapOf(treeId to treeKeyB64), masterKey))

            // Offline write through the engine, then push.
            val engine = SyncEngine(InMemoryMirrorStore(), InMemoryOutboxStore())
            val entry = mapOf("title" to "Zondag", "content" to "Vanaf de telefoon geschreven.")
            engine.localCreate(treeId, EntityType.JOURNAL_ENTRIES, TraumaCrypto.encryptForApi(entry, treeKey))
            val push = engine.buildPush(treeId)
            api.pushSync(treeId, push.request)
            engine.markPushed(treeId, push.opIds)

            // A "second device": fetch the ring, unwrap the tree key, pull
            // the journal, and decrypt what was written.
            val ring = TraumaCrypto.decryptKeyRing(api.fetchKeyRing(), masterKey)
            val unwrapped = TraumaCrypto.importTreeKey(ring.getValue(treeId))
            val pulled = api.pullEntities(treeId, EntityType.JOURNAL_ENTRIES)
            assertEquals(1, pulled.size)
            val decrypted: Map<String, String> =
                TraumaCrypto.decryptFromApi(pulled.single().encryptedData, unwrapped)
            assertEquals(entry, decrypted)

            // And the pull round-trips through reconciliation without drama.
            engine.applyPull(treeId, EntityType.JOURNAL_ENTRIES, pulled)
            assertEquals(0, engine.pendingCount(treeId))
            assertTrue(
                TraumaCrypto.json.parseToJsonElement(pulled.single().encryptedData).jsonObject.containsKey("iv"),
            )
        }
    }
}
