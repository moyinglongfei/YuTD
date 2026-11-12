package com.yutd.app.local.phase

import com.yutd.app.local.utils.*
import com.getcapacitor.JSObject
import java.time.*
import androidx.room.*

@Entity(tableName = "phases")
data class PhaseRecord(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String, val startDate: String, val endDate: String,
    val createdAt: String = Instant.now().toString(), val updatedAt: String = createdAt,
)

@Dao
interface PhaseDao {
    @Query("SELECT * FROM phases ORDER BY startDate, id") suspend fun phases(): List<PhaseRecord>
    @Query("SELECT * FROM phases WHERE id = :id") suspend fun phase(id: Long): PhaseRecord?
    @Insert suspend fun insertPhase(value: PhaseRecord): Long
    @Update suspend fun savePhase(value: PhaseRecord)
    @Query("DELETE FROM phases WHERE id = :id") suspend fun deletePhase(id: Long)
}

internal fun PhaseRecord.weekCount(): Int = ((day(endDate).toEpochDay() - day(startDate).toEpochDay()) / 7 + 1).toInt()

internal fun PhaseRecord.weekNumber(date: LocalDate): Int? = if (date < day(startDate) || date > day(endDate)) null
    else ((date.toEpochDay() - day(startDate).toEpochDay()) / 7 + 1).toInt()

internal fun PhaseRecord.toJson(): JSObject = obj("id" to id, "name" to name,
    "startDate" to iso(day(startDate).atStartOfDay(ZoneOffset.UTC).toInstant()),
    "endDate" to iso(day(endDate).atStartOfDay(ZoneOffset.UTC).toInstant()), "createdAt" to createdAt, "updatedAt" to updatedAt)
