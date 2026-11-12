package com.yutd.app.local.preferences

import com.yutd.app.local.LocalDatabase
import com.yutd.app.local.utils.*
import org.json.JSONObject
import java.time.*
import com.yutd.app.local.phase.*
import com.yutd.app.local.style.*

class PreferencesService internal constructor(private val database: LocalDatabase) {
    private val dao = database.preferencesDao()

    internal suspend fun initialize() {
        if (dao.preferences() == null) dao.savePreferences(PreferencesRecord(activeStyleId = database.styles.initialize().id))
    }
    internal suspend fun require(): PreferencesRecord { initialize(); return requireNotNull(dao.preferences()) }
    internal suspend fun saveRecord(value: PreferencesRecord) = dao.savePreferences(value)

    suspend fun get(): PreferencesRecord = database.read { requireNotNull(dao.preferences()) }

    suspend fun update(data: JSONObject, replace: Boolean = false): PreferencesRecord = database.write {
        data.checked(preferenceFields, if (replace) preferenceFields else emptySet())
        val current = requireNotNull(dao.preferences())
        val phaseId = data.nullableId("defaultPhaseId", current.defaultPhaseId)
        if (phaseId != null && database.phases.find(phaseId) == null) {
            throw LocalApiException("默认阶段不存在", "NOT_FOUND")
        }
        val styleId = data.nullableId("activeStyleId", current.activeStyleId)
        if (styleId != null && database.styles.find(styleId) == null) {
            throw LocalApiException("启用样式不存在", "NOT_FOUND")
        }
        val timeZone = data.boundedText("timeZone", current.timeZone, 100)
        try { ZoneId.of(timeZone) } catch (_: Exception) {
            throw LocalApiException("时区必须是有效的 IANA 时区，例如 Asia/Shanghai")
        }
        val result = current.copy(
            defaultLocale = data.boundedText("defaultLocale", current.defaultLocale, 40),
            defaultPhaseId = phaseId,
            activeStyleId = styleId,
            sidebarWidth = data.decimal("sidebarWidth", current.sidebarWidth.toDouble(), 64.0, 135.0, true).toInt(),
            maxFocusScale = data.decimal("maxFocusScale", current.maxFocusScale, 0.0, 5.0),
            focusColumnScale = data.decimal("focusColumnScale", current.focusColumnScale, 1.0, 6.0),
            hourPixels = data.decimal("hourPixels", current.hourPixels.toDouble(), 24.0, 200.0, true).toInt(),
            edgePixels = data.decimal("edgePixels", current.edgePixels.toDouble(), 0.0, 100.0, true).toInt(),
            timeZone = timeZone,
            timeZoneAutomatic = data.flag("timeZoneAutomatic", current.timeZoneAutomatic),
        )
        dao.savePreferences(result)
        result
    }

    suspend fun reset(): PreferencesRecord = database.write {
        val result = PreferencesRecord(activeStyleId = database.styles.initialize().id)
        dao.savePreferences(result)
        result
    }
}
