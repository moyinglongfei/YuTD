package com.yutd.app.local.style

import com.yutd.app.local.utils.*
import com.getcapacitor.JSObject
import java.time.*
import androidx.room.*

@Entity(tableName = "styles")
data class StyleRecord(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String = "我的样式",
    val showMode: Int = 1,
    val backgroundPrimary: String = "#f5f7fb",
    val backgroundSecondary: String = "#ffffff",
    val textPrimary: String = "#172033",
    val textSecondary: String = "#64748b",
    val fontFamily: String = "system-ui",
    @ColumnInfo(defaultValue = "'1970-01-01T00:00:00.000Z'") val createdAt: String = Instant.now().toString(),
    @ColumnInfo(defaultValue = "'1970-01-01T00:00:00.000Z'") val updatedAt: String = Instant.now().toString(),
)

@Dao
interface StyleDao {
    @Query("SELECT * FROM styles ORDER BY id")
    suspend fun styles(): List<StyleRecord>
    @Query("SELECT * FROM styles WHERE id = :id")
    suspend fun style(id: Long): StyleRecord?
    @Insert
    suspend fun insertStyle(value: StyleRecord): Long
    @Upsert
    suspend fun saveStyle(value: StyleRecord)
}

internal fun StyleRecord.toJson(): JSObject = obj("id" to id, "name" to name, "showMode" to showMode,
    "backgroundPrimary" to backgroundPrimary, "backgroundSecondary" to backgroundSecondary,
    "textPrimary" to textPrimary, "textSecondary" to textSecondary, "fontFamily" to fontFamily,
    "createdAt" to createdAt, "updatedAt" to updatedAt)

internal fun StyleRecord.toJS() = JSObject().apply {
    put("id", id)
    put("name", name)
    put("showMode", showMode)
    put("backgroundPrimary", backgroundPrimary)
    put("backgroundSecondary", backgroundSecondary)
    put("textPrimary", textPrimary)
    put("textSecondary", textSecondary)
    put("fontFamily", fontFamily)
}

internal val styleFields = setOf(
    "name", "showMode", "backgroundPrimary", "backgroundSecondary", "textPrimary", "textSecondary", "fontFamily",
)
