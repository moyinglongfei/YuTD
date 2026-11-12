package com.yutd.app.local.event

import com.yutd.app.local.utils.*
import com.getcapacitor.JSObject
import java.time.*
import androidx.room.*
import com.yutd.app.local.phase.*

@Entity(tableName = "events", foreignKeys = [ForeignKey(entity = PhaseRecord::class,
    parentColumns = ["id"], childColumns = ["phaseId"], onDelete = ForeignKey.RESTRICT)], indices = [Index("phaseId")])
data class EventRecord(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String, val organizer: String? = null, val location: String? = null,
    val color: String? = null, val phaseId: Long,
    val createdAt: String = Instant.now().toString(), val updatedAt: String = createdAt,
)

@Dao
interface EventDao {
    @Query("SELECT * FROM events ORDER BY createdAt DESC, id DESC") suspend fun events(): List<EventRecord>
    @Query("SELECT * FROM events WHERE id = :id") suspend fun event(id: Long): EventRecord?
    @Insert suspend fun insertEvent(value: EventRecord): Long
    @Update suspend fun saveEvent(value: EventRecord)
    @Query("DELETE FROM events WHERE id = :id") suspend fun deleteEvent(id: Long)
}

internal fun EventRecord.toJson(): JSObject = obj("id" to id, "name" to name, "organizer" to organizer,
    "location" to location, "color" to color, "phaseId" to phaseId, "createdAt" to createdAt, "updatedAt" to updatedAt)
