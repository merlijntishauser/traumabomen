package org.traumabomen.core.sync

import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import org.traumabomen.core.db.CoreDatabase

actual fun openCoreDatabase(name: String): CoreDatabase {
    val driver = JdbcSqliteDriver("jdbc:sqlite:$name")
    CoreDatabase.Schema.create(driver)
    return CoreDatabase(driver)
}
