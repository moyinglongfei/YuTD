package com.yutd.app.local.phase

import com.yutd.app.local.LocalDatabase
import com.yutd.app.local.utils.*
import com.getcapacitor.JSObject
import org.json.JSONObject
import com.yutd.app.local.event.*
import com.yutd.app.local.task.*
import com.yutd.app.local.tip.*
import com.yutd.app.local.preferences.*

class PhaseService internal constructor(private val database: LocalDatabase) {
    private val dao = database.phaseDao()

    internal suspend fun records(): List<PhaseRecord> = dao.phases()
    internal suspend fun find(id: Long): PhaseRecord? = dao.phase(id)
    internal suspend fun require(id: Long): PhaseRecord = find(id) ?: throw LocalApiException("阶段不存在", "NOT_FOUND")

    private suspend fun phaseJson(record: PhaseRecord) = record.toJson().apply {
        put("weekCount", record.weekCount())
        put("_count", obj("events" to database.events.records().count { it.phaseId == record.id }, "tasks" to database.tasks.records().count { it.phaseId == record.id }))
    }

    suspend fun list(): JSObject = database.read { obj("items" to arr(dao.phases().map { phaseJson(it) })) }
    suspend fun get(id: Long): JSObject = database.read { phaseJson(require(id)) }
    suspend fun save(id: Long?, data: JSONObject): JSObject = database.write {
        data.checked(setOf("name", "startDate", "endDate"), if (id == null) setOf("name", "startDate", "endDate") else emptySet())
        val current = id?.let { require(it) }
        val start = day(data.text("startDate", current?.startDate))
        val end = day(data.text("endDate", current?.endDate))
        if (start.dayOfWeek.value != 1 || end.dayOfWeek.value != 7 || end < start) {
            throw LocalApiException("阶段必须从周一开始、周日结束，且结束日期不能早于开始日期")
        }
        var value = PhaseRecord(id = id ?: 0, name = data.text("name", current?.name), startDate = start.toString(), endDate = end.toString(),
            createdAt = current?.createdAt ?: now(), updatedAt = now())
        if (id == null) value = value.copy(id = dao.insertPhase(value)) else {
            dao.savePhase(value)
            database.tasks.calendarForPhase(id).filter { it.weekly }.forEach { database.tasks.saveCalendar(it.copy(weekNumber = value.weekNumber(day(it.date)))) }
        }
        value.toJson().apply { put("weekCount", value.weekCount()) }
    }
    suspend fun delete(id: Long): JSObject = database.write {
        val value = require(id)
        if (database.events.records().any { it.phaseId == id } || database.tasks.records().any { it.phaseId == id }) throw LocalApiException("阶段仍有关联事件或任务，不能删除", "CONFLICT")
        val preferences = database.preferences.get()
        if (preferences.defaultPhaseId == id) database.preferences.saveRecord(preferences.copy(defaultPhaseId = null))
        database.tasks.calendarForPhase(id).forEach { database.tips.unlinkTarget(if (it.weekly) "weeks" else "dates", it.id) }
        database.tips.unlinkTarget("phases", id.toString())
        dao.deletePhase(id)
        value.toJson()
    }
}
