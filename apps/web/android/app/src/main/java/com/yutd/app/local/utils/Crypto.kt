package com.yutd.app.local.utils

import android.util.Base64
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

internal fun lifetime(value: String): Long {
    if (value == "never") return Long.MAX_VALUE
    val match = Regex("^(\\d+)(ms|s|m|h|d|w)$").matchEntire(value) ?: throw LocalApiException("登录有效期格式无效，例如 30d")
    val count = match.groupValues[1].toLongOrNull() ?: throw LocalApiException("登录有效期超出范围")
    val factor = mapOf("ms" to 1L, "s" to 1000L, "m" to 60000L, "h" to 3600000L, "d" to 86400000L, "w" to 604800000L).getValue(match.groupValues[2])
    return try { Math.multiplyExact(count, factor).also { if (it <= 0) throw ArithmeticException() } }
    catch (_: ArithmeticException) { throw LocalApiException("登录有效期超出范围") }
}
internal fun passwordHash(value: String, salt: String): String {
    val spec = PBEKeySpec(value.toCharArray(), Base64.decode(salt, Base64.NO_WRAP or Base64.URL_SAFE), 210000, 256)
    return try { Base64.encodeToString(SecretKeyFactory.getInstance("PBKDF2WithHmacSHA1").generateSecret(spec).encoded, Base64.NO_WRAP) }
    finally { spec.clearPassword() }
}
internal fun random(size: Int): String = ByteArray(size).also { SecureRandom().nextBytes(it) }.let {
    Base64.encodeToString(it, Base64.NO_WRAP or Base64.URL_SAFE or Base64.NO_PADDING)
}
internal fun hash(value: String): String = Base64.encodeToString(MessageDigest.getInstance("SHA-256").digest(value.toByteArray()), Base64.NO_WRAP)
