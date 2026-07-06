package org.traumabomen.core.crypto

import java.security.SecureRandom
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec
import kotlin.io.encoding.Base64
import org.bouncycastle.crypto.generators.Argon2BytesGenerator
import org.bouncycastle.crypto.params.Argon2Parameters

actual fun argon2idDeriveKey(passphrase: String, salt: ByteArray): ByteArray {
    val generator = Argon2BytesGenerator()
    generator.init(
        Argon2Parameters.Builder(Argon2Parameters.ARGON2_id)
            .withVersion(Argon2Parameters.ARGON2_VERSION_13)
            .withSalt(salt)
            .withMemoryAsKB(Argon2Params.MEMORY_KIB)
            .withIterations(Argon2Params.TIME_COST)
            .withParallelism(Argon2Params.PARALLELISM)
            .build(),
    )
    val out = ByteArray(Argon2Params.HASH_LENGTH)
    generator.generateBytes(passphrase.toByteArray(Charsets.UTF_8), out)
    return out
}

private val secureRandom = SecureRandom()

actual class AesGcmKey actual constructor(private val rawKey: ByteArray) {
    init {
        require(rawKey.size == 32) { "AES-256-GCM needs a 32-byte key, got ${rawKey.size}" }
    }

    actual fun encrypt(plaintext: String): EncryptedBlob {
        val iv = ByteArray(IV_LENGTH).also(secureRandom::nextBytes)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(
            Cipher.ENCRYPT_MODE,
            SecretKeySpec(rawKey, "AES"),
            GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv),
        )
        val ciphertextWithTag = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))
        return EncryptedBlob(Base64.encode(iv), Base64.encode(ciphertextWithTag))
    }

    actual fun decrypt(blob: EncryptedBlob): String {
        val iv = Base64.decode(blob.iv)
        if (iv.size != IV_LENGTH) {
            throw DecryptException("Invalid IV length: expected $IV_LENGTH, got ${iv.size}")
        }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(
            Cipher.DECRYPT_MODE,
            SecretKeySpec(rawKey, "AES"),
            GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv),
        )
        val plaintext =
            try {
                cipher.doFinal(Base64.decode(blob.ciphertext))
            } catch (e: AEADBadTagException) {
                throw DecryptException()
            }
        return plaintext.toString(Charsets.UTF_8)
    }
}
