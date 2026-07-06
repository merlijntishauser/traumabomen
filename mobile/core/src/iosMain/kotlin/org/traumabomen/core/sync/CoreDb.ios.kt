package org.traumabomen.core.sync

import app.cash.sqldelight.driver.native.NativeSqliteDriver
import org.traumabomen.core.db.CoreDatabase

actual fun openCoreDatabase(name: String): CoreDatabase =
    CoreDatabase(NativeSqliteDriver(CoreDatabase.Schema, name))
