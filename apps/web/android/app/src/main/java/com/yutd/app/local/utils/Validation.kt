package com.yutd.app.local.utils

import org.json.JSONObject
import org.json.JSONArray

class LocalApiException(message: String, val code: String = "VALIDATION") : Exception(message)

internal fun JSONObject.checked(allowed: Set<String>, required: Set<String> = emptySet()) {
    val keys = keys().asSequence().toSet()
    if (!allowed.containsAll(keys)) throw LocalApiException("包含未知字段：${(keys - allowed).joinToString()}")
    if (!keys.containsAll(required)) throw LocalApiException("缺少字段：${(required - keys).joinToString()}")
}
internal fun JSONObject.text(key: String, fallback: String? = null, trim: Boolean = true, min: Int = 1, max: Int = Int.MAX_VALUE): String {
    val raw = if (!has(key)) fallback else get(key) as? String
    val value = raw?.let { if (trim) it.trim() else it } ?: throw LocalApiException("$key 必须是字符串")
    if (value.length !in min..max) throw LocalApiException("$key 长度无效")
    return value
}
internal fun JSONObject.optionalText(key: String, fallback: String? = null): String? =
    if (has(key)) text(key, trim = false, min = 0) else fallback
internal fun JSONObject.number(key: String, fallback: Long? = null, min: Long = 1, max: Long = 9007199254740991L, query: Boolean = false): Long {
    if (!has(key)) return fallback ?: throw LocalApiException("缺少字段：$key")
    val value = when (val raw = get(key)) {
        is Number -> raw.toDouble()
        is String -> if (query && raw.isNotBlank()) raw.toDoubleOrNull() else null
        else -> null
    } ?: throw LocalApiException("$key 必须是整数")
    if (!value.isFinite() || value % 1.0 != 0.0 || value < min || value > max) throw LocalApiException("$key 超出有效范围")
    return value.toLong()
}
internal fun JSONObject.optionalId(key: String, fallback: Long? = null, query: Boolean = false, nullable: Boolean = false): Long? =
    if (!has(key)) fallback else if (isNull(key) && nullable) null else number(key, query = query)
internal fun JSONObject.flag(key: String, fallback: Boolean = false): Boolean =
    if (!has(key)) fallback else get(key) as? Boolean ?: throw LocalApiException("$key 必须是布尔值")
internal fun JSONObject.array(key: String): List<Any> {
    val value = opt(key) as? JSONArray ?: throw LocalApiException("$key 必须是数组")
    return (0 until value.length()).map { value.get(it) }
}
internal fun JSONObject.strings(key: String): List<String> = array(key).map {
    it as? String ?: throw LocalApiException("$key 必须是字符串数组")
}
internal fun JSONObject.ids(key: String): List<Long> = array(key).map { obj("id" to it).number("id") }.distinct()
internal fun JSONObject.objects(key: String): List<JSONObject> = array(key).map {
    it as? JSONObject ?: throw LocalApiException("$key 必须是对象数组")
}
internal fun JSONObject.boundedText(key: String, fallback: String, maxLength: Int): String = text(key, fallback, max = maxLength)
internal fun JSONObject.decimal(key: String, fallback: Double, min: Double, max: Double, integer: Boolean = false): Double {
    if (!has(key)) return fallback
    val value = (get(key) as? Number)?.toDouble() ?: throw LocalApiException("$key 必须是数字")
    if (!value.isFinite() || value < min || value > max || (integer && value % 1.0 != 0.0)) throw LocalApiException("$key 超出有效范围")
    return value
}
internal fun JSONObject.nullableId(key: String, fallback: Long?): Long? = optionalId(key, fallback, nullable = true)
internal fun JSONObject.color(key: String, fallback: String): String = text(key, fallback, max = 7).also {
    if (!Regex("^#[0-9a-fA-F]{6}$").matches(it)) throw LocalApiException("$key 必须是六位十六进制颜色")
}
