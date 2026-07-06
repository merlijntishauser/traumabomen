package org.traumabomen.core.api

import io.ktor.client.HttpClient

/** The platform's default HTTP engine: Darwin on iOS, CIO on the JVM. */
expect fun platformHttpClient(): HttpClient

/** Convenience factory for app code: platform engine, in-memory tokens. */
fun createApiClient(baseUrl: String): ApiClient = ApiClient(baseUrl, platformHttpClient())
