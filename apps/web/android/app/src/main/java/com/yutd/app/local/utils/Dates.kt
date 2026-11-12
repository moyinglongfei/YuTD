package com.yutd.app.local.utils

import java.time.*

internal fun now(): String = iso(Instant.now())
internal fun iso(value: Instant): String = java.time.format.DateTimeFormatterBuilder().appendInstant(3).toFormatter().format(value)
internal fun day(value: String): LocalDate = try {
    if (!Regex("^\\d{4}-\\d{2}-\\d{2}$").matches(value)) throw IllegalArgumentException()
    LocalDate.parse(value)
} catch (_: Exception) { throw LocalApiException("日期必须是有效的 YYYY-MM-DD") }
internal fun zone(value: String): ZoneId = try { ZoneId.of(value) }
    catch (_: Exception) { throw LocalApiException("时区必须是有效的 IANA 时区") }
internal fun dateTime(value: String, zone: ZoneId, compatible: Boolean = false): Instant = try {
    if (Regex("^\\d{4}-\\d{2}-\\d{2}$").matches(value)) {
        val date = day(value)
        val start = date.atStartOfDay(zone)
        if (start.toLocalDate() != date) throw IllegalArgumentException()
        start.toInstant()
    } else if (Regex("(?i)(z|[+-]\\d{2}:?\\d{2})$").containsMatchIn(value)) {
        val normalized = value.replace(' ', 'T').replace('t', 'T').replace('z', 'Z')
            .replace(Regex("([+-]\\d{2})(\\d{2})$"), "$1:$2")
        OffsetDateTime.parse(normalized).toInstant()
    } else {
        val local = LocalDateTime.parse(value.replace(' ', 'T').replace('t', 'T'))
        val offsets = zone.rules.getValidOffsets(local)
        if (!compatible && offsets.size != 1) throw IllegalArgumentException()
        ZonedDateTime.ofLocal(local, zone, offsets.firstOrNull()).toInstant()
    }
} catch (error: LocalApiException) { throw error }
catch (_: Exception) { throw LocalApiException("日期时间无效，或在当前时区不存在／有歧义；请使用带偏移的 ISO 时间") }
