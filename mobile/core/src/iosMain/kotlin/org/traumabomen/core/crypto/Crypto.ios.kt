package org.traumabomen.core.crypto

import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.addressOf
import kotlinx.cinterop.convert
import kotlinx.cinterop.reinterpret
import kotlinx.cinterop.usePinned
import libsodium.crypto_aead_aes256gcm_abytes
import libsodium.crypto_aead_aes256gcm_decrypt
import libsodium.crypto_aead_aes256gcm_encrypt
import libsodium.crypto_aead_aes256gcm_is_available
import libsodium.crypto_pwhash
import libsodium.crypto_pwhash_ALG_ARGON2ID13
import libsodium.randombytes_buf
import libsodium.sodium_init

/**
 * iOS actuals backed by libsodium, built from the pinned official source
 * (scripts/build-libsodium.sh) and bound via cinterop. Byte-compatibility
 * with the web client's argon2-browser + WebCrypto output is proven by the
 * shared fixture suite in commonTest and was first established in
 * mobile/spikes/crypto-compat.
 */

@OptIn(ExperimentalForeignApi::class)
private fun ensureSodium() {
    check(sodium_init() >= 0) { "libsodium failed to initialize" }
}

@OptIn(ExperimentalForeignApi::class)
actual fun argon2idDeriveKey(passphrase: String, salt: ByteArray): ByteArray {
    ensureSodium()
    require(passphrase.isNotEmpty()) { "empty passphrase" }
    require(salt.size == 16) { "Argon2id salt must be 16 bytes, got ${salt.size}" }

    val out = ByteArray(Argon2Params.HASH_LENGTH)
    // The binding takes the passphrase as a Kotlin String (const char* in C,
    // marshalled as UTF-8); the explicit length is its UTF-8 byte count.
    val passphraseUtf8Length = passphrase.encodeToByteArray().size
    val rc = out.usePinned { outPin ->
        salt.usePinned { saltPin ->
            crypto_pwhash(
                outPin.addressOf(0).reinterpret(),
                out.size.convert(),
                passphrase,
                passphraseUtf8Length.convert(),
                saltPin.addressOf(0).reinterpret(),
                Argon2Params.TIME_COST.convert(),
                (Argon2Params.MEMORY_KIB.toLong() * 1024L).convert(),
                crypto_pwhash_ALG_ARGON2ID13,
            )
        }
    }
    check(rc == 0) { "Argon2id derivation failed (out of memory?)" }
    return out
}

@OptIn(ExperimentalForeignApi::class)
actual class AesGcmKey actual constructor(private val rawKey: ByteArray) {
    init {
        require(rawKey.size == 32) { "AES-256-GCM needs a 32-byte key, got ${rawKey.size}" }
        ensureSodium()
        // Hardware AES is present on every arm64 iPhone; libsodium's
        // aes256gcm refuses to run without it, so fail loudly if absent.
        check(crypto_aead_aes256gcm_is_available() == 1) { "AES-GCM unavailable on this device" }
    }

    private val tagBytes = crypto_aead_aes256gcm_abytes().toInt()

    actual fun encrypt(plaintext: String): EncryptedBlob {
        val iv = ByteArray(IV_LENGTH)
        iv.usePinned { randombytes_buf(it.addressOf(0), iv.size.convert()) }

        val message = plaintext.encodeToByteArray()
        val ciphertextWithTag = ByteArray(message.size + tagBytes)
        val rc = ciphertextWithTag.usePinned { ctPin ->
            message.usePinned { mPin ->
                iv.usePinned { ivPin ->
                    rawKey.usePinned { keyPin ->
                        crypto_aead_aes256gcm_encrypt(
                            ctPin.addressOf(0).reinterpret(), null,
                            mPin.addressOf(0).reinterpret(), message.size.convert(),
                            null, 0u, null,
                            ivPin.addressOf(0).reinterpret(),
                            keyPin.addressOf(0).reinterpret(),
                        )
                    }
                }
            }
        }
        check(rc == 0) { "AES-GCM encryption failed" }
        return EncryptedBlob(
            iv = kotlin.io.encoding.Base64.encode(iv),
            ciphertext = kotlin.io.encoding.Base64.encode(ciphertextWithTag),
        )
    }

    @Throws(DecryptException::class)
    actual fun decrypt(blob: EncryptedBlob): String {
        val iv = kotlin.io.encoding.Base64.decode(blob.iv)
        if (iv.size != IV_LENGTH) {
            throw DecryptException("Invalid IV length: expected $IV_LENGTH, got ${iv.size}")
        }
        val ciphertextWithTag = kotlin.io.encoding.Base64.decode(blob.ciphertext)
        if (ciphertextWithTag.size < tagBytes) throw DecryptException()

        val message = ByteArray(ciphertextWithTag.size - tagBytes)
        val rc = message.usePinned { mPin ->
            ciphertextWithTag.usePinned { ctPin ->
                iv.usePinned { ivPin ->
                    rawKey.usePinned { keyPin ->
                        crypto_aead_aes256gcm_decrypt(
                            if (message.isEmpty()) null else mPin.addressOf(0).reinterpret(),
                            null, null,
                            ctPin.addressOf(0).reinterpret(), ciphertextWithTag.size.convert(),
                            null, 0u,
                            ivPin.addressOf(0).reinterpret(),
                            keyPin.addressOf(0).reinterpret(),
                        )
                    }
                }
            }
        }
        if (rc != 0) throw DecryptException()
        return message.decodeToString()
    }
}
