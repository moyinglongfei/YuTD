package com.yutd.app.local.task

import com.yutd.app.local.LocalDatabase
import com.yutd.app.local.utils.*
import com.getcapacitor.JSObject
import org.json.JSONObject
import java.time.*
import com.yutd.app.local.phase.*
import com.yutd.app.local.event.*
import com.yutd.app.local.tip.*
import com.yutd.app.local.preferences.*

class TaskService internal constructor(private val database: LocalDatabase) {
    private val dao = database.taskDao()

    internal suspend fun records(): List<TaskRecord> = dao.tasks()
    internal suspend fun find(id: Long): TaskRecord? = dao.task(id)
    internal suspend fun require(id: Long): TaskRecord = find(id) ?: throw LocalApiException("任务不存在", "NOT_FOUND")
    internal suspend fun tags(): List<TagRecord> = dao.tags()
    internal suspend fun calendar(id: String, weekly: Boolean): CalendarRecord? = dao.calendar(id, weekly)
    internal suspend fun calendarForPhase(id: Long): List<CalendarRecord> = dao.phaseCalendar(id)
    internal suspend fun saveCalendar(value: CalendarRecord) = dao.saveCalendar(value)

    internal suspend fun data(value: TaskRecord): JSObject = value.toJson().apply {
        put("isDone", value.completed)
        put("phase", database.phases.require(value.phaseId).toJson())
        put("event", value.eventId?.let { database.events.require(it).toJson() } ?: JSONObject.NULL)
        put("reminders", arr(dao.reminders(value.id).map { obj("id" to it.id, "taskId" to it.taskId, "time" to it.time) }))
        put("tags", arr(dao.tags().filter { it.taskId == value.id }.map { obj("id" to it.id, "taskId" to it.taskId, "name" to it.name) }))
        put("tips", arr(database.tips.linkedTo("tasks", value.id.toString()).map { it.toJson() }))
    }

    suspend fun list(query: JSONObject): JSObject = database.read {
        query.checked(setOf("status", "phaseId", "eventId", "tag"))
        val phaseId = query.optionalId("phaseId", query = true)
        val eventId = query.optionalId("eventId", query = true)
        val status = query.optionalText("status")
        if (status != null && status !in taskStatuses) throw LocalApiException("任务状态无效")
        val tag = query.optionalText("tag")
        val tags = dao.tags()
        obj("items" to arr(dao.tasks().filter { (phaseId == null || it.phaseId == phaseId)
            && (eventId == null || it.eventId == eventId) && (status == null || it.status == status)
            && (tag == null || tags.any { item -> item.taskId == it.id && item.name == tag }) }.map { data(it) }))
    }

    suspend fun save(id: Long?, data: JSONObject): JSObject = database.write {
        data.checked(taskFields + if (id != null) setOf("isDone") else emptySet(), if (id == null) setOf("title", "dueDate", "phaseId") else emptySet())
        val current = id?.let { require(it) }
        val timeZone = zone(database.preferences.get().timeZone)
        val phaseId = data.number("phaseId", current?.phaseId)
        if (database.phases.find(phaseId) == null) throw LocalApiException("所属阶段不存在")
        val eventId = data.optionalId("eventId", current?.eventId, nullable = id != null)
        if (eventId != null) {
            val owner = database.events.find(eventId) ?: throw LocalApiException("关联事件不存在")
            if (owner.phaseId != phaseId) throw LocalApiException("关联事件与任务不属于同一阶段")
        }
        val due = if (data.has("dueDate")) {
            if (data.isNull("dueDate")) throw LocalApiException("请选择截止时间")
            iso(dateTime(data.text("dueDate"), timeZone))
        } else current?.dueDate ?: throw LocalApiException("请选择截止时间")
        val planned = if (!data.has("plannedDate")) current?.plannedDate else if (data.isNull("plannedDate") && id != null) null
            else data.text("plannedDate", min = 0).takeIf { it.isNotEmpty() }?.let { iso(dateTime(it, timeZone)) }
        if (planned != null && Instant.parse(planned) >= Instant.parse(due)) throw LocalApiException("计划时间必须早于截止时间")
        val previous = if (current?.status == "CANCELLED") "CANCELLED" else if (current?.completed == true) "DONE" else current?.status ?: "TODO"
        val explicitStatus = data.optionalText("status")
        if (explicitStatus != null && explicitStatus !in taskStatuses) throw LocalApiException("任务状态无效")
        val isDone = if (data.has("isDone")) data.flag("isDone") else null
        if (isDone != null && explicitStatus != null && isDone != (explicitStatus == "DONE")) throw LocalApiException("完成状态与任务状态不一致")
        val status = explicitStatus ?: if (isDone == null) previous else if (isDone) "DONE" else if (previous == "DOING") "DOING" else "TODO"
        val closed = status == "DONE" || status == "CANCELLED"
        var value = TaskRecord(id = id ?: 0, title = data.text("title", current?.title),
            description = data.optionalText("description", current?.description), priority = data.number("priority", current?.priority?.toLong() ?: 3, 1, 5).toInt(),
            phaseId = phaseId, eventId = eventId, dueDate = due, plannedDate = planned, status = status, completed = status == "DONE",
            completedAt = if (closed) (if (previous == status) current?.completedAt else null) ?: now() else null,
            estimatedTime = current?.estimatedTime, actualTime = current?.actualTime, createdAt = current?.createdAt ?: now(), updatedAt = now())
        if (id == null) value = value.copy(id = dao.insertTask(value)) else dao.saveTask(value)
        if (data.has("reminderTimes")) {
            val times = data.strings("reminderTimes").map { iso(dateTime(it, timeZone)) }.distinct()
            dao.clearReminders(value.id)
            times.forEach { dao.insertReminder(ReminderRecord(taskId = value.id, time = it)) }
        }
        if (data.has("tags")) {
            val names = data.strings("tags").map { it.trim() }.filter { it.isNotEmpty() }.distinct()
            dao.clearTags(value.id)
            names.forEach { dao.insertTag(TagRecord(taskId = value.id, name = it)) }
        }
        data(value)
    }

    suspend fun postpone(id: Long, data: JSONObject): JSObject = database.write {
        data.checked(setOf("plannedDate"), setOf("plannedDate"))
        val value = require(id)
        if (value.completed || value.status in setOf("DONE", "CANCELLED")) throw LocalApiException("已完成或已放弃的任务无需延期")
        val planned = dateTime(data.text("plannedDate"), zone(database.preferences.get().timeZone))
        if (planned <= Instant.now()) throw LocalApiException("延期时间必须晚于当前时间")
        if (value.dueDate != null && planned >= Instant.parse(value.dueDate)) throw LocalApiException("延期时间必须早于截止时间")
        val updated = value.copy(plannedDate = iso(planned), updatedAt = now())
        dao.saveTask(updated)
        data(updated)
    }

    suspend fun attention(query: JSONObject, weekly: Boolean, data: JSONObject? = null): JSObject {
        suspend fun readAttention(): JSObject {
            query.checked(if (weekly) setOf("phase", "weekNumber") else setOf("phase", "date"), if (weekly) setOf("weekNumber") else setOf("date"))
            val phaseId = query.optionalId("phase", query = true)
            val owner = phaseId?.let { database.phases.require(it) }
            val timeZone = zone(database.preferences.get().timeZone)
            val date = if (weekly) {
                if (owner == null) throw LocalApiException("周查询需要指定阶段和周数")
                day(owner.startDate).plusWeeks(query.number("weekNumber", max = owner.weekCount().toLong(), query = true) - 1)
            } else dateTime(query.text("date"), timeZone).atZone(timeZone).toLocalDate()
            val range = attentionRange(date, timeZone, weekly)
            val week = if (weekly) owner?.weekNumber(range.date) else null
            val key = "${phaseId ?: "all"}:${range.date}"
            val calendar = dao.calendar(key, weekly) ?: CalendarRecord(key, range.date.toString(), weekly, phaseId, weekNumber = week)
            val tasks = dao.tasks().filter { (phaseId == null || it.phaseId == phaseId) &&
                (range.contains(it.plannedDate) || range.contains(it.dueDate)
                    || (!it.completed && it.status !in setOf("DONE", "CANCELLED") && (range.before(it.plannedDate) || range.before(it.dueDate)))) }
                .sortedWith(compareByDescending<TaskRecord> { it.priority }.thenBy { it.id })
            val allDone = tasks.all { it.completed || it.status in setOf("DONE", "CANCELLED") }
            val cleared = if (data == null) { if (allDone && calendar.taskState == 1) 1 else 0 } else {
                data.checked(setOf("cleared"), setOf("cleared"))
                data.number("cleared", min = 0, max = 1).toInt()
            }
            if (cleared == 1 && !allDone) throw LocalApiException("还有未处理任务，暂时不能全部清空")
            dao.saveCalendar(calendar.copy(taskState = cleared, weekNumber = week))
            return obj("date" to date.toString(), "timeZone" to timeZone.id, "startDate" to range.date.toString(),
                "endDate" to range.date.plusDays(if (weekly) 6 else 0).toString(), "rangeStart" to iso(range.start), "rangeEnd" to iso(range.end),
                "tasks" to arr(tasks.map { data(it) }), "allDone" to allDone, "cleared" to cleared, "weekNumber" to week,
                "phase" to owner?.let { obj("startDate" to it.startDate, "endDate" to it.endDate, "weekCount" to it.weekCount()) })
        }
        return if (data == null) database.read { readAttention() } else database.write { readAttention() }
    }
}
