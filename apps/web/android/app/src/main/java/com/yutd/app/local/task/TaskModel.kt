package com.yutd.app.local.task

import com.yutd.app.local.utils.*
import com.getcapacitor.JSObject
import org.json.JSONObject
import java.time.*
import androidx.room.*
import com.yutd.app.local.phase.*
import com.yutd.app.local.event.*

@Entity(tableName = "tasks", foreignKeys = [
    ForeignKey(entity = PhaseRecord::class, parentColumns = ["id"], childColumns = ["phaseId"], onDelete = ForeignKey.RESTRICT),
    ForeignKey(entity = EventRecord::class, parentColumns = ["id"], childColumns = ["eventId"], onDelete = ForeignKey.SET_NULL),
], indices = [Index("phaseId"), Index("eventId"), Index("completedAt"), Index("plannedDate"), Index("dueDate")])
data class TaskRecord(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val title: String, val description: String? = null, val priority: Int = 3,
    val completed: Boolean = false, val completedAt: String? = null, val status: String = "TODO",
    val phaseId: Long, val eventId: Long? = null, val dueDate: String?, val plannedDate: String? = null,
    val estimatedTime: Int? = null, val actualTime: Int? = null,
    val createdAt: String = Instant.now().toString(), val updatedAt: String = createdAt,
)

@Entity(tableName = "task_reminders", foreignKeys = [ForeignKey(entity = TaskRecord::class,
    parentColumns = ["id"], childColumns = ["taskId"], onDelete = ForeignKey.CASCADE)],
    indices = [Index(value = ["taskId", "time"], unique = true), Index("time")])
data class ReminderRecord(@PrimaryKey(autoGenerate = true) val id: Long = 0, val taskId: Long, val time: String)

@Entity(tableName = "task_tags", foreignKeys = [ForeignKey(entity = TaskRecord::class,
    parentColumns = ["id"], childColumns = ["taskId"], onDelete = ForeignKey.CASCADE)],
    indices = [Index(value = ["taskId", "name"], unique = true), Index("name")])
data class TagRecord(@PrimaryKey(autoGenerate = true) val id: Long = 0, val taskId: Long, val name: String)

@Entity(tableName = "calendar", primaryKeys = ["id", "weekly"], foreignKeys = [ForeignKey(entity = PhaseRecord::class,
    parentColumns = ["id"], childColumns = ["phaseId"], onDelete = ForeignKey.CASCADE)], indices = [Index("phaseId"), Index("date")])
data class CalendarRecord(val id: String, val date: String, val weekly: Boolean,
    val phaseId: Long? = null, val taskState: Int = 0, val weekNumber: Int? = null)

@Dao
interface TaskDao {
    @Query("SELECT * FROM tasks ORDER BY createdAt DESC, id DESC") suspend fun tasks(): List<TaskRecord>
    @Query("SELECT * FROM tasks WHERE id = :id") suspend fun task(id: Long): TaskRecord?
    @Insert suspend fun insertTask(value: TaskRecord): Long
    @Update suspend fun saveTask(value: TaskRecord)
    @Query("SELECT * FROM task_reminders WHERE taskId = :id ORDER BY time, id") suspend fun reminders(id: Long): List<ReminderRecord>
    @Query("DELETE FROM task_reminders WHERE taskId = :id") suspend fun clearReminders(id: Long)
    @Insert suspend fun insertReminder(value: ReminderRecord): Long
    @Query("SELECT * FROM task_tags ORDER BY name, id") suspend fun tags(): List<TagRecord>
    @Query("DELETE FROM task_tags WHERE taskId = :id") suspend fun clearTags(id: Long)
    @Insert suspend fun insertTag(value: TagRecord): Long
    @Query("SELECT * FROM calendar WHERE id = :id AND weekly = :weekly") suspend fun calendar(id: String, weekly: Boolean): CalendarRecord?
    @Query("SELECT * FROM calendar WHERE phaseId = :phaseId") suspend fun phaseCalendar(phaseId: Long): List<CalendarRecord>
    @Upsert suspend fun saveCalendar(value: CalendarRecord)
}

internal fun TaskRecord.toJson(): JSObject = obj("id" to id, "title" to title, "description" to description,
    "priority" to priority, "completed" to completed, "completedAt" to completedAt, "status" to status,
    "phaseId" to phaseId, "eventId" to eventId, "dueDate" to dueDate, "plannedDate" to plannedDate,
    "estimatedTime" to estimatedTime, "actualTime" to actualTime, "createdAt" to createdAt, "updatedAt" to updatedAt)

internal fun CalendarRecord.toJson(): JSObject = obj("id" to id, "date" to date, "phaseId" to phaseId, "taskState" to taskState).apply {
    if (weekly) put("weekNumber", weekNumber ?: JSONObject.NULL)
}

internal val taskStatuses = setOf("TODO", "DOING", "DONE", "CANCELLED")
internal val taskFields = setOf("title", "description", "priority", "dueDate", "plannedDate", "reminderTimes", "tags", "phaseId", "eventId", "status")

internal data class AttentionRange(val date: LocalDate, val start: Instant, val end: Instant) {
    fun contains(value: String?): Boolean = value != null && Instant.parse(value).let { it >= start && it < end }
    fun before(value: String?): Boolean = value != null && Instant.parse(value) < start
}
internal fun attentionRange(date: LocalDate, timeZone: java.time.ZoneId, weekly: Boolean): AttentionRange {
    val first = if (weekly) date.minusDays((date.dayOfWeek.value - 1).toLong()) else date
    val start = dateTime(first.toString(), timeZone)
    return AttentionRange(first, start, first.plusDays(if (weekly) 7 else 1).atStartOfDay(timeZone).toInstant())
}
