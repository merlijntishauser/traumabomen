package org.traumabomen.core.sync

import org.traumabomen.core.db.CoreDatabase

/**
 * Open (or create) the on-device core database: the ciphertext mirror and
 * the offline outbox. Contents are ciphertext and structural metadata only.
 */
expect fun openCoreDatabase(name: String): CoreDatabase
