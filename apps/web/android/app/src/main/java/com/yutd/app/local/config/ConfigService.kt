package com.yutd.app.local.config

import com.yutd.app.local.LocalDatabase
import com.yutd.app.local.utils.*
import com.getcapacitor.JSObject
import org.json.JSONObject
import com.yutd.app.local.auth.*

class ConfigService internal constructor(private val database: LocalDatabase) {
    private val dao = database.configDao()

    internal suspend fun authentication(): JSONObject = initialize().getJSONObject("auth")

    private suspend fun initialize(): JSONObject {
        val current = dao.config()
        if (current != null) return JSONObject(current.json)
        val value = defaultConfig()
        dao.saveConfig(ConfigRecord(json = value.toString()))
        return value
    }
    private fun publicConfig(value: JSONObject) = obj("system" to value.getJSONObject("system"),
        "auth" to value.getJSONObject("auth").let { obj("enabled" to it.getBoolean("enabled"), "expiresIn" to it.getString("expiresIn")) },
        "features" to value.getJSONObject("features"))

    suspend fun get(): JSObject = database.read { publicConfig(initialize()) }
    suspend fun update(data: JSONObject): JSObject = database.write {
        data.checked(setOf("system", "auth", "features"))
        val current = initialize()
        for ((key, allowed) in mapOf("system" to setOf("host", "port"), "auth" to setOf("enabled", "password", "expiresIn"), "features" to setOf("enableReminder"))) {
            if (!data.has(key)) continue
            val patch = data.opt(key) as? JSONObject ?: throw LocalApiException("$key 必须是对象")
            patch.checked(allowed)
            val target = current.getJSONObject(key)
            when (key) {
                "system" -> {
                    if (patch.has("host")) target.put("host", patch.text("host"))
                    if (patch.has("port")) target.put("port", patch.number("port", min = 0, max = 65535))
                }
                "auth" -> {
                    if (patch.has("enabled")) target.put("enabled", patch.flag("enabled"))
                    if (patch.has("expiresIn")) {
                        val expiry = patch.text("expiresIn")
                        lifetime(expiry)
                        target.put("expiresIn", expiry)
                    }
                    if (patch.has("password")) {
                        val password = patch.text("password", trim = false, min = 0, max = 4096)
                        val salt = random(24)
                        target.put("salt", salt)
                        target.put("passwordHash", passwordHash(password, salt))
                    }
                    if (target.getBoolean("enabled") && target.getString("passwordHash").isEmpty()) throw LocalApiException("启用本地登录前请先设置密码")
                    database.auth.clearSessions()
                }
                else -> if (patch.has("enableReminder")) target.put("enableReminder", patch.flag("enableReminder"))
            }
        }
        dao.saveConfig(ConfigRecord(json = current.toString()))
        publicConfig(current)
    }
}
