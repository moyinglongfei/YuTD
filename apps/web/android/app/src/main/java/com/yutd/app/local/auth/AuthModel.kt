package com.yutd.app.local.auth

import com.yutd.app.local.utils.*
import androidx.room.*

@Entity(tableName = "local_sessions")
data class SessionRecord(@PrimaryKey val tokenHash: String, val expiresAt: Long)

@Dao
interface AuthDao {
    @Query("SELECT * FROM local_sessions WHERE tokenHash = :hash") suspend fun session(hash: String): SessionRecord?
    @Upsert suspend fun saveSession(value: SessionRecord)
    @Query("DELETE FROM local_sessions") suspend fun clearSessions()
    @Query("DELETE FROM local_sessions WHERE expiresAt < :now") suspend fun expireSessions(now: Long)
}
