package com.yutd.app.local.version

import com.yutd.app.local.LocalDatabase
import com.yutd.app.local.utils.*
import java.time.*
import com.yutd.app.local.preferences.*

class VersionService internal constructor(private val database: LocalDatabase) {
    private val dao = database.versionDao()

    internal suspend fun initialize() {
        if (dao.dataVersion() == null) dao.saveDataVersion(DataVersionRecord())
    }
    internal suspend fun increment() = dao.bumpVersion()

    suspend fun get(): String = database.read {
        val current = requireNotNull(dao.dataVersion())
        val zone = ZoneId.of(database.preferences.require().timeZone)
        if (Instant.parse(current.updatedAt).atZone(zone).toLocalDate() != Instant.now().atZone(zone).toLocalDate()) {
            dao.bumpVersion()
        }
        requireNotNull(dao.dataVersion()).version.toString()
    }
}
