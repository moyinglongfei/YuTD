package com.yutd.app.local.event

import com.yutd.app.local.LocalDatabase
import com.yutd.app.local.utils.*
import com.getcapacitor.JSObject
import org.json.JSONObject
import com.yutd.app.local.phase.*
import com.yutd.app.local.eventschedule.*
import com.yutd.app.local.task.*
import com.yutd.app.local.tip.*

class EventService internal constructor(private val database: LocalDatabase) {
    private val dao = database.eventDao()

    internal suspend fun records(): List<EventRecord> = dao.events()
    internal suspend fun find(id: Long): EventRecord? = dao.event(id)
    internal suspend fun require(id: Long): EventRecord = find(id) ?: throw LocalApiException("事件不存在", "NOT_FOUND")

    internal suspend fun eventJson(record: EventRecord): JSObject = record.toJson().apply {
        put("phase", database.phases.require(record.phaseId).toJson())
        put("schedules", arr(database.schedules.records().filter { it.eventId == record.id }.map { it.toJson() }))
        put("tips", arr(database.tips.linkedTo("events", record.id.toString()).map { it.toJson() }))
        put("_count", obj("tasks" to database.tasks.records().count { it.eventId == record.id }))
    }

    suspend fun list(query: JSONObject): JSObject = database.read {
        query.checked(setOf("phaseId"))
        val phaseId = query.optionalId("phaseId", query = true)
        obj("items" to arr(dao.events().filter { phaseId == null || it.phaseId == phaseId }.map { eventJson(it) }))
    }
    suspend fun get(id: Long): JSObject = database.read { eventJson(require(id)) }
    suspend fun save(id: Long?, data: JSONObject): JSObject = database.write {
        data.checked(setOf("name", "organizer", "location", "color", "phaseId") + if (id == null) setOf("schedules") else emptySet(),
            if (id == null) setOf("name", "phaseId") else emptySet())
        val current = id?.let { require(it) }
        val phaseId = data.number("phaseId", current?.phaseId)
        if (database.phases.find(phaseId) == null) throw LocalApiException("所属阶段不存在")
        if (current != null && phaseId != current.phaseId && database.tasks.records().any { it.eventId == id && it.phaseId != phaseId }) {
            throw LocalApiException("关联任务与事件必须属于同一阶段")
        }
        var value = EventRecord(id = id ?: 0, name = data.text("name", current?.name), phaseId = phaseId,
            organizer = data.optionalText("organizer", current?.organizer), location = data.optionalText("location", current?.location),
            color = data.optionalText("color", current?.color), createdAt = current?.createdAt ?: now(), updatedAt = now())
        if (id == null) value = value.copy(id = dao.insertEvent(value)) else dao.saveEvent(value)
        if (data.has("schedules")) data.objects("schedules").forEach { database.schedules.save(null, JSONObject(it.toString()).put("eventId", value.id)) }
        eventJson(value)
    }
    suspend fun delete(id: Long): JSObject = database.write {
        val value = require(id)
        database.tips.unlinkTarget("events", id.toString())
        dao.deleteEvent(id)
        value.toJson()
    }
}
