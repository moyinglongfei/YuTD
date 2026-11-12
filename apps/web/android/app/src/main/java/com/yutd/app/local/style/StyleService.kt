package com.yutd.app.local.style

import com.yutd.app.local.LocalDatabase
import com.yutd.app.local.utils.*
import org.json.JSONObject
import java.time.*

class StyleService internal constructor(private val database: LocalDatabase) {
    private val dao = database.styleDao()

    internal suspend fun records(): List<StyleRecord> = dao.styles()
    internal suspend fun find(id: Long): StyleRecord? = dao.style(id)
    internal suspend fun initialize(): StyleRecord = dao.styles().firstOrNull()
        ?: StyleRecord().let { it.copy(id = dao.insertStyle(it)) }

    suspend fun list(): List<StyleRecord> = database.read { dao.styles() }

    suspend fun get(id: Long): StyleRecord = database.read { findStyle(id) }

    suspend fun create(data: JSONObject): StyleRecord = database.write {
        data.checked(styleFields, styleFields - "showMode")
        val result = styleFrom(data, StyleRecord())
        result.copy(id = dao.insertStyle(result))
    }

    suspend fun update(id: Long, data: JSONObject): StyleRecord = database.write {
        data.checked(styleFields)
        val result = styleFrom(data, findStyle(id)).copy(updatedAt = Instant.now().toString())
        dao.saveStyle(result)
        result
    }

    private suspend fun findStyle(id: Long): StyleRecord = dao.style(id)
        ?: throw LocalApiException("样式预设不存在", "NOT_FOUND")

    private fun styleFrom(data: JSONObject, current: StyleRecord): StyleRecord = current.copy(
        name = data.boundedText("name", current.name, 80),
        showMode = data.decimal("showMode", current.showMode.toDouble(), 0.0, 1.0, true).toInt(),
        backgroundPrimary = data.color("backgroundPrimary", current.backgroundPrimary),
        backgroundSecondary = data.color("backgroundSecondary", current.backgroundSecondary),
        textPrimary = data.color("textPrimary", current.textPrimary),
        textSecondary = data.color("textSecondary", current.textSecondary),
        fontFamily = data.boundedText("fontFamily", current.fontFamily, 200),
    )
}
