package com.yutd.app.local.tip

import com.yutd.app.local.utils.*
import com.getcapacitor.JSObject
import java.time.*
import androidx.room.*

@Entity(tableName = "tips")
data class TipRecord(@PrimaryKey(autoGenerate = true) val id: Long = 0, val content: String,
    val createdAt: String = Instant.now().toString(), val updatedAt: String = createdAt)

@Entity(tableName = "tip_links", primaryKeys = ["tipId", "kind", "targetId"],
    foreignKeys = [ForeignKey(entity = TipRecord::class, parentColumns = ["id"], childColumns = ["tipId"], onDelete = ForeignKey.CASCADE)],
    indices = [Index(value = ["kind", "targetId"])])
data class TipLink(val tipId: Long, val kind: String, val targetId: String)

@Dao
interface TipDao {
    @Query("SELECT * FROM tips ORDER BY createdAt DESC, id DESC") suspend fun tips(): List<TipRecord>
    @Query("SELECT * FROM tips WHERE id = :id") suspend fun tip(id: Long): TipRecord?
    @Insert suspend fun insertTip(value: TipRecord): Long
    @Update suspend fun saveTip(value: TipRecord)
    @Query("DELETE FROM tips WHERE id = :id") suspend fun deleteTip(id: Long)
    @Query("SELECT * FROM tip_links WHERE tipId = :id") suspend fun links(id: Long): List<TipLink>
    @Query("SELECT * FROM tip_links WHERE kind = :kind AND targetId = :target") suspend fun linkedTips(kind: String, target: String): List<TipLink>
    @Insert(onConflict = OnConflictStrategy.IGNORE) suspend fun link(value: TipLink)
    @Query("DELETE FROM tip_links WHERE tipId = :id AND kind = :kind") suspend fun clearLinks(id: Long, kind: String)
    @Query("DELETE FROM tip_links WHERE kind = :kind AND targetId = :target") suspend fun unlinkTarget(kind: String, target: String)
}

internal fun TipRecord.toJson(): JSObject = obj("id" to id, "content" to content, "createdAt" to createdAt, "updatedAt" to updatedAt)
