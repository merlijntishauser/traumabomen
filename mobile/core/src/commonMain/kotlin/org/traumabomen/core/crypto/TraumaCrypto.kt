package org.traumabomen.core.crypto

import kotlin.io.encoding.Base64
import kotlinx.serialization.json.Json

/**
 * The zero-knowledge crypto facade, mirroring frontend/src/lib/crypto.ts:
 *
 * passphrase + salt -> Argon2id -> master key
 * master key decrypts the key ring: a map of tree id to base64 tree key
 * tree keys decrypt entity payloads
 *
 * API payloads are doubly encoded exactly like the web client: the entity is
 * JSON, encrypted, and the resulting blob is itself serialized to a JSON
 * string stored in encrypted_data.
 */
object TraumaCrypto {
    val json: Json = Json { ignoreUnknownKeys = true }

    fun deriveMasterKey(passphrase: String, saltBase64: String): AesGcmKey =
        AesGcmKey(argon2idDeriveKey(passphrase, Base64.decode(saltBase64)))

    /**
     * Raw master key bytes, for platform key custody (Secure Enclave
     * wrapping on iOS). Callers own zeroing their copies.
     */
    fun deriveMasterKeyBytes(passphrase: String, saltBase64: String): ByteArray =
        argon2idDeriveKey(passphrase, Base64.decode(saltBase64))

    /** Rebuild a key from custody-released raw bytes. */
    fun keyFromBytes(rawKey: ByteArray): AesGcmKey = AesGcmKey(rawKey)

    fun importTreeKey(base64Key: String): AesGcmKey = AesGcmKey(Base64.decode(base64Key))

    /** @throws DecryptException on a wrong passphrase (Swift-catchable). */
    @Throws(DecryptException::class)
    fun decryptKeyRing(encryptedKeyRing: String, masterKey: AesGcmKey): Map<String, String> =
        decryptFromApi(encryptedKeyRing, masterKey)

    fun encryptKeyRing(keyRing: Map<String, String>, masterKey: AesGcmKey): String =
        encryptForApi(keyRing, masterKey)

    inline fun <reified T> decryptFromApi(encryptedData: String, key: AesGcmKey): T {
        val blob = json.decodeFromString<EncryptedBlob>(encryptedData)
        return json.decodeFromString(key.decrypt(blob))
    }

    inline fun <reified T> encryptForApi(data: T, key: AesGcmKey): String {
        val blob = key.encrypt(json.encodeToString(data))
        return json.encodeToString(blob)
    }
}
