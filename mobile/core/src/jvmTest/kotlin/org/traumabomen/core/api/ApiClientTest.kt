package org.traumabomen.core.api

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.engine.mock.toByteArray
import io.ktor.client.request.HttpRequestData
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.traumabomen.core.sync.EntityType

private class Recorded(val requests: MutableList<HttpRequestData> = mutableListOf())

private fun jsonHeaders() = headersOf("Content-Type", "application/json")

private fun harness(
    handler: suspend io.ktor.client.engine.mock.MockRequestHandleScope.(
        HttpRequestData,
    ) -> io.ktor.client.request.HttpResponseData,
): Triple<ApiClient, InMemoryTokenStore, Recorded> {
    val recorded = Recorded()
    val engine = MockEngine { request ->
        recorded.requests.add(request)
        handler(request)
    }
    val store = InMemoryTokenStore()
    return Triple(ApiClient("https://api.test", HttpClient(engine), store), store, recorded)
}

private suspend fun HttpRequestData.bodyText(): String = String(body.toByteArray())

class ApiClientTest {
    @Test
    fun loginPostsCredentialsAndStoresTheTokenPair() = runBlocking {
        val (api, store, recorded) = harness {
            respond(
                """{"access_token":"acc-1","refresh_token":"ref-1","token_type":"bearer",
                   "encryption_salt":"salt-b64","passphrase_hint":"the usual one"}""",
                headers = jsonHeaders(),
            )
        }

        val salt = api.login("a@b.nl", "pw")

        assertEquals("salt-b64", salt.encryptionSalt)
        assertEquals("the usual one", salt.passphraseHint)
        assertEquals("acc-1", store.accessToken)
        assertEquals("ref-1", store.refreshToken)

        val req = recorded.requests.single()
        assertEquals("https://api.test/auth/login", req.url.toString())
        // FastAPI only parses JSON-typed bodies; text/plain 422s server-side.
        assertEquals("application/json", req.body.contentType?.toString())
        val body = Json.parseToJsonElement(req.bodyText()).jsonObject
        assertEquals("a@b.nl", body["email"]!!.jsonPrimitive.content)
        assertEquals("pw", body["password"]!!.jsonPrimitive.content)
    }

    @Test
    fun authenticatedRequestsCarryTheBearerToken() = runBlocking {
        val (api, store, recorded) = harness {
            respond("""{"encryption_salt":"s","passphrase_hint":null}""", headers = jsonHeaders())
        }
        store.accessToken = "acc-7"

        val salt = api.fetchSalt()

        assertNull(salt.passphraseHint)
        assertEquals("Bearer acc-7", recorded.requests.single().headers["Authorization"])
    }

    @Test
    fun expiredAccessTokenRotatesThroughRefreshAndRetries() = runBlocking {
        val (api, store, recorded) = harness { request ->
            when {
                request.url.encodedPath == "/auth/refresh" ->
                    respond("""{"access_token":"acc-2","refresh_token":"ref-2"}""", headers = jsonHeaders())
                request.headers["Authorization"] == "Bearer acc-2" ->
                    respond("""{"encrypted_key_ring":"ring-blob"}""", headers = jsonHeaders())
                else -> respond("expired", HttpStatusCode.Unauthorized)
            }
        }
        store.accessToken = "acc-stale"
        store.refreshToken = "ref-1"

        val ring = api.fetchKeyRing()

        assertEquals("ring-blob", ring)
        assertEquals("acc-2", store.accessToken)
        assertEquals("ref-2", store.refreshToken)
        // stale attempt, refresh, retried attempt
        assertEquals(3, recorded.requests.size)
        val refreshBody = recorded.requests[1].bodyText()
        assertEquals("ref-1", Json.parseToJsonElement(refreshBody).jsonObject["refresh_token"]!!.jsonPrimitive.content)
    }

    @Test
    fun failedRefreshSurfacesAsApiError() = runBlocking {
        val (api, store, _) = harness { request ->
            when (request.url.encodedPath) {
                "/auth/refresh" -> respond("revoked", HttpStatusCode.Unauthorized)
                else -> respond("expired", HttpStatusCode.Unauthorized)
            }
        }
        store.accessToken = "stale"
        store.refreshToken = "revoked-family"

        val error = assertFailsWith<ApiError> { api.fetchKeyRing() }
        assertEquals(401, error.status)
    }

    @Test
    fun pullMapsPersonLinkedEntities() = runBlocking {
        val (api, store, recorded) = harness {
            respond(
                """[{"id":"e1","person_ids":["p1","p2"],"encrypted_data":"blob",
                    "created_at":"2026-01-01T00:00:00","updated_at":"2026-01-02T00:00:00"}]""",
                headers = jsonHeaders(),
            )
        }
        store.accessToken = "acc"

        val entities = api.pullEntities("tree-1", EntityType.LIFE_EVENTS)

        assertEquals("https://api.test/trees/tree-1/life-events", recorded.requests.single().url.toString())
        assertEquals(listOf("p1", "p2"), entities.single().personIds)
        assertEquals("blob", entities.single().encryptedData)
    }

    @Test
    fun pullMapsRelationshipEndpointsIntoThePersonIdsConvention() = runBlocking {
        val (api, store, _) = harness {
            respond(
                """[{"id":"r1","source_person_id":"parent","target_person_id":"child","encrypted_data":"edge-blob"}]""",
                headers = jsonHeaders(),
            )
        }
        store.accessToken = "acc"

        val entities = api.pullEntities("tree-1", EntityType.RELATIONSHIPS)

        assertEquals(listOf("parent", "child"), entities.single().personIds)
    }

    @Test
    fun pushSyncPostsTheRequestBodyVerbatim() = runBlocking {
        val (api, store, recorded) = harness {
            respond("""{"persons_created":[]}""", headers = jsonHeaders())
        }
        store.accessToken = "acc"
        val request = buildJsonObject { put("journal_entries_create", buildJsonObject { put("x", "y") }) }

        api.pushSync("tree-9", request)

        val req = recorded.requests.single()
        assertEquals("https://api.test/trees/tree-9/sync", req.url.toString())
        assertEquals(request.toString(), req.bodyText())
    }

    @Test
    fun serverErrorsSurfaceWithStatusAndBody() = runBlocking {
        val (api, store, _) = harness { respond("boom", HttpStatusCode.InternalServerError) }
        store.accessToken = "acc"

        val error = assertFailsWith<ApiError> { api.listTrees() }
        assertEquals(500, error.status)
        assertTrue(error.message!!.contains("boom"))
    }
}
