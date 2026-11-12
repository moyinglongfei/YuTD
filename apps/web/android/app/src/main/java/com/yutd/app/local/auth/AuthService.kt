package com.yutd.app.local.auth

import com.yutd.app.local.LocalDatabase
import com.yutd.app.local.utils.*
import com.getcapacitor.JSObject
import org.json.JSONObject
import com.yutd.app.local.config.*

class AuthService internal constructor(private val database: LocalDatabase) {
    private val dao = database.authDao()

    internal suspend fun session(token: String?): SessionRecord? = token?.let { dao.session(hash(it)) }
    internal suspend fun clearSessions() = dao.clearSessions()

    suspend fun login(data: JSONObject): JSObject = database.write {
        data.checked(setOf("password"), setOf("password"))
        val password = data.text("password", trim = false, min = 0, max = 4096)
        val auth = database.config.authentication()
        val expected = auth.getString("passwordHash")
        val valid = if (expected.isEmpty()) password.isEmpty() else java.security.MessageDigest.isEqual(
            expected.toByteArray(), passwordHash(password, auth.getString("salt")).toByteArray())
        if (!valid) throw LocalApiException("密码错误", "UNAUTHORIZED")
        val token = random(32)
        val duration = lifetime(auth.getString("expiresIn"))
        val expires = if (duration == Long.MAX_VALUE) Long.MAX_VALUE else try { Math.addExact(System.currentTimeMillis(), duration) }
            catch (_: ArithmeticException) { throw LocalApiException("登录有效期超出范围") }
        dao.expireSessions(System.currentTimeMillis())
        dao.saveSession(SessionRecord(hash(token), expires))
        obj("token" to token)
    }
}
