package org.traumabomen.core.crypto

import kotlinx.serialization.Serializable

/**
 * The wire format every encrypted field uses, identical to the web client
 * (frontend/src/lib/crypto.ts): a JSON object of two base64 strings. The IV
 * is 12 bytes; the ciphertext carries the 16-byte GCM tag appended, which is
 * WebCrypto's native layout. Platform actuals that separate the tag
 * (CryptoKit's SealedBox) split it back out themselves.
 */
@Serializable
data class EncryptedBlob(val iv: String, val ciphertext: String)
