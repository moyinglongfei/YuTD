package com.yutd.app.local.preferences

import com.getcapacitor.JSObject
import org.json.JSONObject
import androidx.room.*
import com.yutd.app.local.style.*

@Entity(
    tableName = "preferences",
    foreignKeys = [ForeignKey(
        entity = StyleRecord::class,
        parentColumns = ["id"],
        childColumns = ["activeStyleId"],
        onDelete = ForeignKey.SET_NULL,
    )],
    indices = [Index("activeStyleId")],
)
data class PreferencesRecord(
    @PrimaryKey val id: Int = 1,
    val defaultLocale: String = "zh-CN",
    val defaultPhaseId: Long? = null,
    val activeStyleId: Long? = null,
    val sidebarWidth: Int = 64,
    val maxFocusScale: Double = 2.0,
    val focusColumnScale: Double = 3.0,
    val hourPixels: Int = 72,
    val edgePixels: Int = 20,
    val timeZone: String = "Asia/Shanghai",
    val timeZoneAutomatic: Boolean = true,
)

@Dao
interface PreferencesDao {
    @Query("SELECT * FROM preferences WHERE id = 1")
    suspend fun preferences(): PreferencesRecord?
    @Upsert
    suspend fun savePreferences(value: PreferencesRecord)
}

internal fun PreferencesRecord.toJS() = JSObject().apply {
    put("defaultLocale", defaultLocale)
    put("defaultPhaseId", defaultPhaseId ?: JSONObject.NULL)
    put("activeStyleId", activeStyleId ?: JSONObject.NULL)
    put("sidebarWidth", sidebarWidth)
    put("maxFocusScale", maxFocusScale)
    put("focusColumnScale", focusColumnScale)
    put("hourPixels", hourPixels)
    put("edgePixels", edgePixels)
    put("timeZone", timeZone)
    put("timeZoneAutomatic", timeZoneAutomatic)
}

internal val preferenceFields = setOf(
    "defaultLocale", "defaultPhaseId", "activeStyleId", "sidebarWidth", "maxFocusScale",
    "focusColumnScale", "hourPixels", "edgePixels", "timeZone", "timeZoneAutomatic",
)
