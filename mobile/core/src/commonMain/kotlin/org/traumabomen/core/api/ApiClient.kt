package org.traumabomen.core.api

import io.ktor.client.HttpClient
import io.ktor.client.request.header
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.TextContent
import io.ktor.http.isSuccess
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.traumabomen.core.sync.EntityType
import org.traumabomen.core.sync.ServerEntity

/**
 * Holds the JWT pair. The interface is the seam for platform keychains;
 * the in-memory implementation backs tests and the pre-persistence phase.
 * Tokens are auth-only and carry no encryption material.
 */
interface TokenStore {
    var accessToken: String?
    var refreshToken: String?
}

class InMemoryTokenStore : TokenStore {
    override var accessToken: String? = null
    override var refreshToken: String? = null
}

class ApiError(val status: Int, message: String) : Exception("HTTP $status: $message")

data class SaltInfo(val encryptionSalt: String, val passphraseHint: String?)

data class TreeSummary(val id: String, val encryptedData: String, val isDemo: Boolean)

/**
 * The thin typed client over the existing backend. No new endpoints: JWT
 * auth with refresh rotation, per-tree entity pulls, and the bulk sync
 * push. JSON is built and parsed explicitly with kotlinx-serialization so
 * every payload byte is visible here.
 */
class ApiClient(
    private val baseUrl: String,
    private val http: HttpClient,
    private val tokens: TokenStore = InMemoryTokenStore(),
) {
    private val json = Json { ignoreUnknownKeys = true }

    /** Register a new account; the client generates and owns the salt. */
    suspend fun register(email: String, password: String, encryptionSalt: String) {
        val body = buildJsonObject {
            put("email", email)
            put("password", password)
            put("encryption_salt", encryptionSalt)
        }
        raw(HttpMethod.Post, "/auth/register", body)
    }

    /** Log in; the server returns both tokens plus the encryption salt. */
    suspend fun login(email: String, password: String): SaltInfo {
        val body = buildJsonObject {
            put("email", email)
            put("password", password)
        }
        val response = raw(HttpMethod.Post, "/auth/login", body)
        val payload = parse(response)
        tokens.accessToken = payload.str("access_token")
        tokens.refreshToken = payload.str("refresh_token")
        return SaltInfo(payload.str("encryption_salt"), payload.strOrNull("passphrase_hint"))
    }

    suspend fun fetchSalt(): SaltInfo {
        val payload = parse(authed(HttpMethod.Get, "/auth/salt"))
        return SaltInfo(payload.str("encryption_salt"), payload.strOrNull("passphrase_hint"))
    }

    /** The encrypted key ring blob; decrypted client-side with the master key. */
    suspend fun fetchKeyRing(): String =
        parse(authed(HttpMethod.Get, "/auth/key-ring")).str("encrypted_key_ring")

    suspend fun putKeyRing(encryptedKeyRing: String) {
        authed(
            HttpMethod.Put,
            "/auth/key-ring",
            buildJsonObject { put("encrypted_key_ring", encryptedKeyRing) },
        )
    }

    /** Create a tree (integration tests and future onboarding; the companion UI itself never creates trees). */
    suspend fun createTree(encryptedData: String): String =
        parse(
            authed(HttpMethod.Post, "/trees", buildJsonObject { put("encrypted_data", encryptedData) }),
        ).str("id")

    suspend fun listTrees(): List<TreeSummary> {
        val response = authed(HttpMethod.Get, "/trees")
        return json.parseToJsonElement(response.bodyAsText()).jsonArray.map {
            val obj = it.jsonObject
            TreeSummary(
                id = obj.str("id"),
                encryptedData = obj.str("encrypted_data"),
                isDemo = obj["is_demo"]?.jsonPrimitive?.content == "true",
            )
        }
    }

    /**
     * Pull all entities of one type for a tree, mapped to the sync engine's
     * [ServerEntity]. Person links land in personIds; for relationships the
     * convention is personIds = [source_person_id, target_person_id].
     */
    suspend fun pullEntities(treeId: String, type: EntityType): List<ServerEntity> {
        val response = authed(HttpMethod.Get, "/trees/$treeId/${type.apiPath}")
        return json.parseToJsonElement(response.bodyAsText()).jsonArray.map {
            val obj = it.jsonObject
            ServerEntity(
                id = obj.str("id"),
                encryptedData = obj.str("encrypted_data"),
                personIds = when {
                    type == EntityType.RELATIONSHIPS ->
                        listOf(obj.str("source_person_id"), obj.str("target_person_id"))
                    type.personLinked ->
                        obj["person_ids"]!!.jsonArray.map { id -> id.jsonPrimitive.content }
                    else -> emptyList()
                },
            )
        }
    }

    /** Push one bulk sync request (built by SyncEngine.buildPush). */
    suspend fun pushSync(treeId: String, request: JsonObject) {
        authed(HttpMethod.Post, "/trees/$treeId/sync", request)
    }

    /**
     * Send an authenticated request; on 401, rotate the token pair through
     * /auth/refresh once and retry. A refresh failure surfaces as ApiError
     * 401: the session is over and the UI must re-authenticate.
     */
    private suspend fun authed(method: HttpMethod, path: String, body: JsonObject? = null): HttpResponse {
        val first = raw(method, path, body, bearer = tokens.accessToken, throwOnError = false)
        if (first.status != HttpStatusCode.Unauthorized) return checked(first)

        val refresh = requireNotNull(tokens.refreshToken) { "no refresh token; log in first" }
        val rotated = parse(raw(HttpMethod.Post, "/auth/refresh", buildJsonObject { put("refresh_token", refresh) }))
        tokens.accessToken = rotated.str("access_token")
        tokens.refreshToken = rotated.str("refresh_token")

        return checked(raw(method, path, body, bearer = tokens.accessToken, throwOnError = false))
    }

    private suspend fun raw(
        method: HttpMethod,
        path: String,
        body: JsonObject? = null,
        bearer: String? = null,
        throwOnError: Boolean = true,
    ): HttpResponse {
        val response = http.request("$baseUrl$path") {
            this.method = method
            bearer?.let { header("Authorization", "Bearer $it") }
            // Explicit TextContent: without the ContentNegotiation plugin a
            // plain String body ships as text/plain, which FastAPI ignores.
            body?.let { setBody(TextContent(it.toString(), ContentType.Application.Json)) }
        }
        return if (throwOnError) checked(response) else response
    }

    private suspend fun checked(response: HttpResponse): HttpResponse {
        if (!response.status.isSuccess()) {
            throw ApiError(response.status.value, response.bodyAsText().take(300))
        }
        return response
    }

    private suspend fun parse(response: HttpResponse): JsonObject =
        json.parseToJsonElement(response.bodyAsText()).jsonObject

    private fun JsonObject.str(key: String): String =
        requireNotNull(this[key]) { "missing field $key" }.jsonPrimitive.content

    private fun JsonObject.strOrNull(key: String): String? =
        this[key]?.jsonPrimitive?.takeUnless { it.toString() == "null" }?.content
}
