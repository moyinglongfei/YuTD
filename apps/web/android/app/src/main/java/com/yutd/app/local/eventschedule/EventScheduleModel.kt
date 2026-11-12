package com.yutd.app.local.eventschedule

import com.yutd.app.local.utils.*
import com.getcapacitor.JSObject
import org.json.JSONArray
import androidx.room.*
import com.yutd.app.local.event.*

@Entity(tableName = "schedules", foreignKeys = [ForeignKey(entity = EventRecord::class,
    parentColumns = ["id"], childColumns = ["eventId"], onDelete = ForeignKey.CASCADE)], indices = [Index("eventId")])
data class ScheduleRecord(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val eventId: Long, val weekday: Int, val startTime: String, val endTime: String,
    val weeks: String, val organizer: String? = null, val location: String? = null,
)

@Dao
interface EventScheduleDao {
    @Query("SELECT * FROM schedules ORDER BY weekday, startTime, id") suspend fun schedules(): List<ScheduleRecord>
    @Query("SELECT * FROM schedules WHERE id = :id") suspend fun schedule(id: Long): ScheduleRecord?
    @Insert suspend fun insertSchedule(value: ScheduleRecord): Long
    @Update suspend fun saveSchedule(value: ScheduleRecord)
    @Query("DELETE FROM schedules WHERE id = :id") suspend fun deleteSchedule(id: Long)
}

internal fun ScheduleRecord.toJson(): JSObject = obj("id" to id, "eventId" to eventId, "weekday" to weekday,
    "startTime" to startTime, "endTime" to endTime, "weeks" to JSONArray(weeks), "organizer" to organizer, "location" to location)
