package com.yutd.app.local.version

import com.yutd.app.local.utils.*
import java.time.*
import androidx.room.*

@Entity(tableName = "data_version")
data class DataVersionRecord(
    @PrimaryKey val id: Int = 1,
    val version: Long = 0,
    @ColumnInfo(defaultValue = "'1970-01-01T00:00:00.000Z'") val updatedAt: String = Instant.now().toString(),
)

@Dao
interface VersionDao {
    @Query("SELECT * FROM data_version WHERE id = 1")
    suspend fun dataVersion(): DataVersionRecord?
    @Upsert
    suspend fun saveDataVersion(value: DataVersionRecord)
    @Query("UPDATE data_version SET version = version + 1, updatedAt = :now WHERE id = 1")
    suspend fun bumpVersion(now: String = Instant.now().toString())
}
