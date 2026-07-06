package org.traumabomen.core.sync

import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import org.traumabomen.core.db.CoreDatabase

class SessionCacheTest {
    private fun cache(): SessionCache {
        val driver = JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY)
        CoreDatabase.Schema.create(driver)
        return SessionCache(CoreDatabase(driver))
    }

    @Test
    fun roundTripsUnlockInputs() {
        val c = cache()
        c.saltBase64 = "c2FsdA=="
        c.passphraseHint = "boomsoort en jaartal"
        c.encryptedKeyRing = """{"iv":"x","ciphertext":"y"}"""

        assertEquals("c2FsdA==", c.saltBase64)
        assertEquals("boomsoort en jaartal", c.passphraseHint)
        assertEquals("""{"iv":"x","ciphertext":"y"}""", c.encryptedKeyRing)
    }

    @Test
    fun nilAssignmentRemovesAndClearWipesAll() {
        val c = cache()
        c.saltBase64 = "a"
        c.passphraseHint = "b"
        c.encryptedKeyRing = "c"

        c.passphraseHint = null
        assertNull(c.passphraseHint)

        c.clear()
        assertNull(c.saltBase64)
        assertNull(c.encryptedKeyRing)
    }

    @Test
    fun emptyCacheReturnsNulls() {
        val c = cache()
        assertNull(c.saltBase64)
        assertNull(c.passphraseHint)
        assertNull(c.encryptedKeyRing)
    }
}
