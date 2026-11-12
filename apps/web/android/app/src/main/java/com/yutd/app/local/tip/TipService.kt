package com.yutd.app.local.tip

import com.yutd.app.local.LocalDatabase
import com.yutd.app.local.utils.*
import com.getcapacitor.JSObject
import org.json.JSONObject
import org.json.JSONArray
import com.yutd.app.local.phase.*
import com.yutd.app.local.event.*
import com.yutd.app.local.eventschedule.*
import com.yutd.app.local.task.*
import com.yutd.app.local.preferences.*

class TipService internal constructor(private val database: LocalDatabase) {
    private val dao = database.tipDao()

    internal suspend fun records(): List<TipRecord> = dao.tips()
    internal suspend fun find(id: Long): TipRecord? = dao.tip(id)
    internal suspend fun require(id: Long): TipRecord = find(id) ?: throw LocalApiException("提示不存在", "NOT_FOUND")
    internal suspend fun linkedTo(kind: String, target: String): List<TipRecord> = dao.linkedTips(kind, target).map { require(it.tipId) }
    internal suspend fun unlinkTarget(kind: String, target: String) = dao.unlinkTarget(kind, target)

    internal suspend fun data(value: TipRecord): JSObject = value.toJson().apply {
        val links = dao.links(value.id)
        for (kind in listOf("dates", "weeks", "events", "phases", "tasks")) {
            val references = links.filter { it.kind == kind }
            val records = when (kind) {
                "dates", "weeks" -> references.mapNotNull { database.tasks.calendar(it.targetId, kind == "weeks") }.sortedBy { it.date }.map { it.toJson() }
                "events" -> references.mapNotNull { database.events.find(it.targetId.toLong()) }.sortedBy { it.id }.map { it.toJson() }
                "phases" -> references.mapNotNull { database.phases.find(it.targetId.toLong()) }.sortedBy { it.id }.map { it.toJson() }
                else -> references.mapNotNull { database.tasks.find(it.targetId.toLong()) }.sortedBy { it.id }.map { it.toJson() }
            }
            put(kind, arr(records))
        }
    }

    suspend fun list(query: JSONObject): JSObject = database.read {
        query.checked(setOf("date", "week", "eventId", "phaseId", "taskId"))
        val selected = dao.tips().filter { value ->
            val links = dao.links(value.id)
            var matches = true
            if (query.has("date")) {
                val date = day(query.text("date")).toString()
                matches = matches && links.filter { it.kind == "dates" }.any { database.tasks.calendar(it.targetId, false)?.date == date }
            }
            if (query.has("week")) {
                val selected = day(query.text("week"))
                val monday = selected.minusDays((selected.dayOfWeek.value - 1).toLong()).toString()
                matches = matches && links.filter { it.kind == "weeks" }.any { database.tasks.calendar(it.targetId, true)?.date == monday }
            }
            for ((key, kind) in mapOf("eventId" to "events", "phaseId" to "phases", "taskId" to "tasks")) {
                if (query.has(key)) matches = matches && links.any { it.kind == kind && it.targetId == query.number(key, query = true).toString() }
            }
            matches
        }
        obj("items" to arr(selected.map { data(it) }))
    }
    suspend fun get(id: Long): JSObject = database.read { data(require(id)) }
    suspend fun save(id: Long?, data: JSONObject): JSObject = database.write {
        data.checked(setOf("content", "dates", "weeks", "dateIds", "weekIds", "eventIds", "phaseIds", "taskIds"), if (id == null) setOf("content") else emptySet())
        val current = id?.let { require(it) }
        val content = data.text("content", current?.content, trim = false)
        if (content.isBlank()) throw LocalApiException("提示内容不能为空")
        var value = TipRecord(id = id ?: 0, content = content, createdAt = current?.createdAt ?: now(),
            updatedAt = if (current != null && content == current.content) current.updatedAt else now())
        if (id == null) value = value.copy(id = dao.insertTip(value)) else dao.saveTip(value)
        for ((key, kind) in mapOf("eventIds" to "events", "phaseIds" to "phases", "taskIds" to "tasks")) {
            if (!data.has(key)) continue
            val ids = data.ids(key)
            ids.forEach {
                val exists = when (kind) { "events" -> database.events.find(it) != null; "phases" -> database.phases.find(it) != null; else -> database.tasks.find(it) != null }
                if (!exists) throw LocalApiException("关联${when (kind) { "events" -> "事件"; "phases" -> "阶段"; else -> "任务" }}不存在")
            }
            dao.clearLinks(value.id, kind)
            ids.forEach { dao.link(TipLink(value.id, kind, it.toString())) }
        }
        for ((kind, key) in mapOf("dates" to "dateIds", "weeks" to "weekIds")) {
            if (!data.has(kind) && !data.has(key)) continue
            val weekly = kind == "weeks"
            val ids = if (data.has(key)) data.strings(key).distinct() else emptyList()
            ids.forEach { if (database.tasks.calendar(it, weekly) == null) throw LocalApiException("关联${if (weekly) "周" else "日期"}不存在") }
            val dates = if (data.has(kind)) data.strings(kind).map { day(it) }.map {
                if (weekly) it.minusDays((it.dayOfWeek.value - 1).toLong()) else it
            }.distinct() else emptyList()
            dao.clearLinks(value.id, kind)
            ids.forEach { dao.link(TipLink(value.id, kind, it)) }
            dates.forEach {
                val key = "all:$it"
                if (database.tasks.calendar(key, weekly) == null) database.tasks.saveCalendar(CalendarRecord(key, it.toString(), weekly))
                dao.link(TipLink(value.id, kind, key))
            }
        }
        data(value)
    }
    suspend fun delete(id: Long): JSObject = database.write {
        val value = require(id)
        dao.deleteTip(id)
        value.toJson()
    }

    suspend fun daily(query: JSONObject): JSObject = database.read {
        query.checked(setOf("date", "phase"), setOf("date"))
        val date = day(query.text("date"))
        val phaseId = query.optionalId("phase", query = true)
        val timeZone = zone(database.preferences.get().timeZone)
        val range = attentionRange(date, timeZone, false)
        val tasks = database.tasks.records().filter { (phaseId == null || it.phaseId == phaseId) && (range.contains(it.plannedDate) || range.contains(it.dueDate)) }
        val occurrences = database.schedules.records().mapNotNull { schedule ->
            val ownerEvent = database.events.require(schedule.eventId)
            val owner = database.phases.require(ownerEvent.phaseId)
            val week = owner.weekNumber(date)
            val weeks = org.json.JSONArray(schedule.weeks)
            if ((phaseId != null && owner.id != phaseId) || schedule.weekday != date.dayOfWeek.value
                || week == null || (0 until weeks.length()).none { weeks.getInt(it) == week }) null
            else {
                val start = dateTime("${date}T${schedule.startTime}", timeZone, true)
                val end = dateTime("${date}T${schedule.endTime}", timeZone, true)
                if (start.atZone(timeZone).toLocalDate() != date) null else obj("eventId" to ownerEvent.id,
                    "scheduleId" to schedule.id, "phaseId" to owner.id, "time" to iso(start), "endTime" to iso(end))
            }
        }
        val eventIds = occurrences.map { it.getLong("eventId") }.toSet()
        val taskIds = tasks.map { it.id }.toSet()
        val monday = date.minusDays((date.dayOfWeek.value - 1).toLong()).toString()
        val selected = dao.tips().filter { value -> dao.links(value.id).any { link ->
            when (link.kind) {
                "events" -> link.targetId.toLong() in eventIds
                "tasks" -> link.targetId.toLong() in taskIds
                "dates", "weeks" -> database.tasks.calendar(link.targetId, link.kind == "weeks")?.let {
                    it.date == (if (it.weekly) monday else date.toString()) && (phaseId == null || it.phaseId == null || it.phaseId == phaseId)
                } ?: false
                else -> false
            }
        } }
        obj("date" to date.toString(), "timeZone" to timeZone.id, "tips" to arr(selected.map { data(it) }),
            "occurrences" to arr(occurrences), "tasks" to arr(tasks.map { obj("id" to it.id, "title" to it.title, "phaseId" to it.phaseId,
                "priority" to it.priority, "plannedDate" to it.plannedDate, "dueDate" to it.dueDate, "completed" to it.completed, "status" to it.status) }))
    }
}
