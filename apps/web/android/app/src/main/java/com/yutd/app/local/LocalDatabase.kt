package com.yutd.app.local

import android.content.Context
import androidx.room.*
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import org.json.JSONArray
import java.time.Instant
import com.yutd.app.local.utils.LocalApiException
import com.yutd.app.local.phase.*
import com.yutd.app.local.event.*
import com.yutd.app.local.eventschedule.*
import com.yutd.app.local.task.*
import com.yutd.app.local.tip.*
import com.yutd.app.local.preferences.*
import com.yutd.app.local.style.*
import com.yutd.app.local.version.*
import com.yutd.app.local.image.*
import com.yutd.app.local.config.*
import com.yutd.app.local.auth.*
import com.yutd.app.local.resource.*

@Database(
    entities = [StyleRecord::class, PreferencesRecord::class, DataVersionRecord::class,
        PhaseRecord::class, EventRecord::class, ScheduleRecord::class, TaskRecord::class,
        ReminderRecord::class, TagRecord::class, TipRecord::class, TipLink::class, CalendarRecord::class,
        ImageRecord::class, BackgroundRecord::class, ConfigRecord::class, SessionRecord::class],
    version = 3,
    autoMigrations = [AutoMigration(from = 1, to = 2)],
    exportSchema = true,
)
abstract class LocalDatabase : RoomDatabase() {
    abstract fun phaseDao(): PhaseDao
    abstract fun eventDao(): EventDao
    abstract fun eventscheduleDao(): EventScheduleDao
    abstract fun taskDao(): TaskDao
    abstract fun tipDao(): TipDao
    abstract fun preferencesDao(): PreferencesDao
    abstract fun styleDao(): StyleDao
    abstract fun versionDao(): VersionDao
    abstract fun imageDao(): ImageDao
    abstract fun configDao(): ConfigDao
    abstract fun authDao(): AuthDao

    private lateinit var applicationContext: Context
    val phases by lazy { PhaseService(this) }
    val events by lazy { EventService(this) }
    val schedules by lazy { EventScheduleService(this) }
    val tasks by lazy { TaskService(this) }
    val tips by lazy { TipService(this) }
    val preferences by lazy { PreferencesService(this) }
    val styles by lazy { StyleService(this) }
    val versions by lazy { VersionService(this) }
    val images by lazy { ImageService(applicationContext, this) }
    val config by lazy { ConfigService(this) }
    val auth by lazy { AuthService(this) }
    val resources by lazy { ResourceService(this) }

    suspend fun <Service : Any, Result> access(service: Service, token: String?, action: suspend Service.() -> Result): Result {
        if (serviceAuthentication[service::class] != false) read { authorize(token) }
        return service.action()
    }

    private suspend fun authorize(token: String?) {
        if (!config.authentication().getBoolean("enabled")) return
        val session = auth.session(token)
        if (session == null || session.expiresAt < System.currentTimeMillis()) {
            throw LocalApiException("未授权或登录已过期", "UNAUTHORIZED")
        }
    }

    internal suspend fun <Result> read(action: suspend () -> Result): Result = withTransaction {
        initializeDefaults()
        action()
    }

    internal suspend fun <Result> write(action: suspend () -> Result): Result = withTransaction {
        initializeDefaults()
        val result = action()
        // 业务写入和缓存版本在同一事务提交，失败时一起回滚。
        versions.increment()
        result
    }

    private suspend fun initializeDefaults() {
        styles.initialize()
        preferences.initialize()
        versions.initialize()
    }

    companion object {
        // 新增服务未列入清单时，默认需要验证。
        private val serviceAuthentication = mapOf(
            PhaseService::class to true,
            EventService::class to true,
            EventScheduleService::class to true,
            TaskService::class to true,
            TipService::class to true,
            PreferencesService::class to true,
            StyleService::class to true,
            VersionService::class to true,
            ImageService::class to true,
            ConfigService::class to true,
            AuthService::class to false,
            ResourceService::class to true,
        )

        @Volatile private var instance: LocalDatabase? = null

        private fun seedStylePresets(database: SupportSQLiteDatabase, context: Context) {
            val presets = JSONArray(context.assets.open("style-presets.json").bufferedReader().use { it.readText() })
            val now = Instant.now().toString()
            for (index in 0 until presets.length()) {
                val preset = presets.getJSONObject(index)
                database.execSQL(
                    """INSERT INTO styles (name, showMode, backgroundPrimary, backgroundSecondary, textPrimary, textSecondary, fontFamily, createdAt, updatedAt)
                       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM styles WHERE name = ?)""",
                    arrayOf<Any>(preset.getString("name"), preset.getInt("showMode"), preset.getString("backgroundPrimary"),
                        preset.getString("backgroundSecondary"), preset.getString("textPrimary"), preset.getString("textSecondary"),
                        preset.getString("fontFamily"), now, now, preset.getString("name")),
                )
            }
        }

        fun get(context: Context): LocalDatabase = instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(
                context.applicationContext, LocalDatabase::class.java, "yutd.db",
            ).addMigrations(object : Migration(2, 3) {
                override fun migrate(db: SupportSQLiteDatabase) {
                    seedStylePresets(db, context.applicationContext)
                    db.execSQL("UPDATE preferences SET sidebarWidth = 64 WHERE id = 1")
                    db.execSQL("UPDATE data_version SET version = version + 1, updatedAt = ? WHERE id = 1", arrayOf(Instant.now().toString()))
                }
            }).addCallback(object : Callback() {
                override fun onCreate(db: SupportSQLiteDatabase) {
                    seedStylePresets(db, context.applicationContext)
                }
            }).build().also {
                it.applicationContext = context.applicationContext
                instance = it
            }
        }
    }
}
