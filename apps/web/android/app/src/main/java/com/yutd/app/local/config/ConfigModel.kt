package com.yutd.app.local.config

import com.yutd.app.local.utils.*
import org.json.JSONObject
import androidx.room.*

@Entity(tableName = "local_config")
data class ConfigRecord(@PrimaryKey val id: Int = 1, val json: String)

@Dao
interface ConfigDao {
    @Query("SELECT * FROM local_config WHERE id = 1") suspend fun config(): ConfigRecord?
    @Upsert suspend fun saveConfig(value: ConfigRecord)
}

internal fun defaultConfig(): JSONObject = obj(
    "system" to obj("host" to "localhost", "port" to 0),
    "auth" to obj("enabled" to false, "expiresIn" to "30d", "salt" to "", "passwordHash" to ""),
    "features" to obj("enableReminder" to false),
)
