package org.traumabomen.core.crypto

/**
 * Argon2id parameters, pinned to the web client's values. Changing any of
 * these breaks every existing user's key derivation; the compatibility
 * fixture test exists to make that impossible to do silently.
 */
object Argon2Params {
    const val TIME_COST = 3
    const val MEMORY_KIB = 65536
    const val HASH_LENGTH = 32
    const val PARALLELISM = 1
}

const val IV_LENGTH = 12
const val GCM_TAG_LENGTH_BITS = 128

/**
 * Derive the 32-byte master key from the passphrase and raw salt bytes via
 * Argon2id 1.3 with [Argon2Params]. Platform bindings: libsodium
 * crypto_pwhash on iOS, BouncyCastle on the JVM. Both are proven against
 * the golden fixture derived by the web client.
 */
expect fun argon2idDeriveKey(passphrase: String, salt: ByteArray): ByteArray

/**
 * An in-memory AES-256-GCM key. Holds raw key material only for the life of
 * the object; nothing here persists it. Every encrypt call uses a fresh
 * random 12-byte IV.
 */
expect class AesGcmKey(rawKey: ByteArray) {
    fun encrypt(plaintext: String): EncryptedBlob

    /** @throws DecryptException when authentication fails (wrong key or corrupt data). */
    fun decrypt(blob: EncryptedBlob): String
}

class DecryptException(message: String = "Failed to decrypt data. Wrong passphrase or corrupted data.") :
    Exception(message)
