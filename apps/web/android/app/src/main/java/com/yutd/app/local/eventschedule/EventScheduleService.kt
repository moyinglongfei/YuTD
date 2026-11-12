package com.yutd.app.local.eventschedule

import com.yutd.app.local.LocalDatabase
import com.yutd.app.local.utils.*
import com.getcapacitor.JSObject
import org.json.JSONObject
import org.json.JSONArray
import com.yutd.app.local.phase.*
import com.yutd.app.local.event.*

class EventScheduleService internal constructor(private val database: LocalDatabase) {
    private val dao = database.eventscheduleDao()

    internal suspend fun records(): List<ScheduleRecord> = dao.schedules()

    private suspend fun scheduleJson(record: ScheduleRecord) = record.toJson().apply {
        put("event", database.events.require(record.eventId).let { it.toJson().apply { put("phase", database.phases.require(it.phaseId).toJson()) } })
    }

    suspend fun list(query: JSONObject): JSObject = database.read {
        query.checked(setOf("phaseId"))
        val phaseId = query.optionalId("phaseId", query = true)
        obj("items" to arr(dao.schedules().filter { phaseId == null || database.events.require(it.eventId).phaseId == phaseId }.map { scheduleJson(it) }))
    }
    suspend fun save(id: Long?, data: JSONObject): JSObject = database.write {
        data.checked(setOf("eventId", "weekday", "startTime", "endTime", "weeks", "organizer", "location"),
            if (id == null) setOf("eventId", "weekday", "startTime", "endTime", "weeks") else emptySet())
        val current = id?.let { dao.schedule(it) ?: throw LocalApiException("事件排期不存在", "NOT_FOUND") }
        val eventId = data.number("eventId", current?.eventId)
        val owner = database.phases.require(database.events.require(eventId).phaseId)
        val start = data.text("startTime", current?.startTime)
        val end = data.text("endTime", current?.endTime)
        val pattern = Regex("^([01]\\d|2[0-3]):[0-5]\\d$")
        if (!pattern.matches(start) || !pattern.matches(end) || start >= end) throw LocalApiException("排期时间无效，结束时间必须晚于开始时间")
        val weeks = if (data.has("weeks")) data.array("weeks").map { obj("week" to it).number("week", max = owner.weekCount().toLong()).toInt() }
            else JSONObject().put("weeks", org.json.JSONArray(current!!.weeks)).array("weeks").map { (it as Number).toInt() }
        if (weeks.isEmpty() || weeks.size != weeks.distinct().size || weeks.any { it !in 1..owner.weekCount() }) throw LocalApiException("存在周数必须唯一且在所属阶段范围内")
        var value = ScheduleRecord(id = id ?: 0, eventId = eventId, weekday = data.number("weekday", current?.weekday?.toLong(), 1, 7).toInt(),
            startTime = start, endTime = end, weeks = arr(weeks.sorted()).toString(),
            organizer = data.optionalText("organizer", current?.organizer), location = data.optionalText("location", current?.location))
        if (id == null) value = value.copy(id = dao.insertSchedule(value)) else dao.saveSchedule(value)
        scheduleJson(value)
    }
    suspend fun delete(id: Long): JSObject = database.write {
        val value = dao.schedule(id) ?: throw LocalApiException("事件排期不存在", "NOT_FOUND")
        dao.deleteSchedule(id)
        value.toJson()
    }
}
