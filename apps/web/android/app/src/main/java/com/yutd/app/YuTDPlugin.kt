package com.yutd.app

import com.yutd.app.local.LocalDatabase
import com.yutd.app.local.preferences.toJS
import com.yutd.app.local.style.toJS
import com.yutd.app.local.utils.LocalApiException
import android.webkit.CookieManager
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import org.json.JSONObject

@CapacitorPlugin(name = "YuTD")
class YuTDPlugin : Plugin() {
    private val database by lazy { LocalDatabase.get(context) }
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    @PluginMethod
    fun getCapabilities(call: PluginCall) {
        val result = JSObject()
        result.put("bridgeVersion", 1)
        result.put("features", JSArray(listOf("preferences", "styles", "dataVersion", "phases", "events", "schedules",
            "tasks", "tips", "resources", "images", "config", "auth")))
        call.resolve(result)
    }

    @PluginMethod
    fun getPreferences(call: PluginCall) = execute(call, database.preferences) { get().toJS() }

    @PluginMethod
    fun updatePreferences(call: PluginCall) = execute(call, database.preferences) {
        val replace = if (!call.data.has("replace")) false else call.data.get("replace") as? Boolean
            ?: throw LocalApiException("replace 必须是布尔值")
        update(body(call), replace).toJS()
    }

    @PluginMethod
    fun resetPreferences(call: PluginCall) = execute(call, database.preferences) { reset().toJS() }

    @PluginMethod
    fun getDataVersion(call: PluginCall) = execute(call, database.versions) {
        JSObject().put("version", get())
    }

    @PluginMethod
    fun listStyles(call: PluginCall) = execute(call, database.styles) {
        JSObject().put("styles", JSArray(list().map { it.toJS() }))
    }

    @PluginMethod
    fun getStyle(call: PluginCall) = execute(call, database.styles) { get(id(call)).toJS() }

    @PluginMethod
    fun createStyle(call: PluginCall) = execute(call, database.styles) { create(body(call)).toJS() }

    @PluginMethod
    fun updateStyle(call: PluginCall) = execute(call, database.styles) { update(id(call), body(call)).toJS() }

    @PluginMethod fun listPhases(call: PluginCall) = execute(call, database.phases) { list() }
    @PluginMethod fun getPhase(call: PluginCall) = execute(call, database.phases) { get(id(call)) }
    @PluginMethod fun createPhase(call: PluginCall) = execute(call, database.phases) { save(null, body(call)) }
    @PluginMethod fun updatePhase(call: PluginCall) = execute(call, database.phases) { save(id(call), body(call)) }
    @PluginMethod fun deletePhase(call: PluginCall) = execute(call, database.phases) { delete(id(call)) }
    @PluginMethod fun listEvents(call: PluginCall) = execute(call, database.events) { list(query(call)) }
    @PluginMethod fun getEvent(call: PluginCall) = execute(call, database.events) { get(id(call)) }
    @PluginMethod fun createEvent(call: PluginCall) = execute(call, database.events) { save(null, body(call)) }
    @PluginMethod fun updateEvent(call: PluginCall) = execute(call, database.events) { save(id(call), body(call)) }
    @PluginMethod fun deleteEvent(call: PluginCall) = execute(call, database.events) { delete(id(call)) }
    @PluginMethod fun listSchedules(call: PluginCall) = execute(call, database.schedules) { list(query(call)) }
    @PluginMethod fun createSchedule(call: PluginCall) = execute(call, database.schedules) { save(null, body(call)) }
    @PluginMethod fun updateSchedule(call: PluginCall) = execute(call, database.schedules) { save(id(call), body(call)) }
    @PluginMethod fun deleteSchedule(call: PluginCall) = execute(call, database.schedules) { delete(id(call)) }
    @PluginMethod fun listTasks(call: PluginCall) = execute(call, database.tasks) { list(query(call)) }
    @PluginMethod fun createTask(call: PluginCall) = execute(call, database.tasks) { save(null, body(call)) }
    @PluginMethod fun updateTask(call: PluginCall) = execute(call, database.tasks) { save(id(call), body(call)) }
    @PluginMethod fun postponeTask(call: PluginCall) = execute(call, database.tasks) { postpone(id(call), body(call)) }
    @PluginMethod fun dailyTasks(call: PluginCall) = execute(call, database.tasks) { attention(query(call), false) }
    @PluginMethod fun weeklyTasks(call: PluginCall) = execute(call, database.tasks) { attention(query(call), true) }
    @PluginMethod fun setDailyTasks(call: PluginCall) = execute(call, database.tasks) { attention(query(call), false, body(call)) }
    @PluginMethod fun setWeeklyTasks(call: PluginCall) = execute(call, database.tasks) { attention(query(call), true, body(call)) }
    @PluginMethod fun listTips(call: PluginCall) = execute(call, database.tips) { list(query(call)) }
    @PluginMethod fun getTip(call: PluginCall) = execute(call, database.tips) { get(id(call)) }
    @PluginMethod fun createTip(call: PluginCall) = execute(call, database.tips) { save(null, body(call)) }
    @PluginMethod fun updateTip(call: PluginCall) = execute(call, database.tips) { save(id(call), body(call)) }
    @PluginMethod fun deleteTip(call: PluginCall) = execute(call, database.tips) { delete(id(call)) }
    @PluginMethod fun dailyTips(call: PluginCall) = execute(call, database.tips) { daily(query(call)) }
    @PluginMethod fun listResources(call: PluginCall) = execute(call, database.resources) { list(query(call)) }
    @PluginMethod fun getConfig(call: PluginCall) = execute(call, database.config) { get() }
    @PluginMethod fun updateConfig(call: PluginCall) = execute(call, database.config) { update(body(call)) }
    @PluginMethod fun login(call: PluginCall) = execute(call, database.auth) {
        val result = login(body(call))
        CookieManager.getInstance().apply {
            setCookie(bridge.appUrl, "yutd-auth-token=${result.getString("token")}; Path=/; Max-Age=2592000; SameSite=Lax")
            flush()
        }
        result
    }
    @PluginMethod fun listImages(call: PluginCall) = execute(call, database.images) { list(query(call)) }
    @PluginMethod fun getImage(call: PluginCall) = execute(call, database.images) { get(string(call, "id")) }
    @PluginMethod fun getImageFile(call: PluginCall) = execute(call, database.images) { file(string(call, "id"), call.getBoolean("thumbnail", false) == true) }
    @PluginMethod fun deleteImage(call: PluginCall) = execute(call, database.images) { remove(string(call, "id")) }
    @PluginMethod fun beginImageUpload(call: PluginCall) = execute(call, database.images) { begin(body(call)) }
    @PluginMethod fun appendImageUpload(call: PluginCall) = execute(call, database.images) { append(body(call)) }
    @PluginMethod fun finishImageUpload(call: PluginCall) = execute(call, database.images) { finish(string(call, "uploadId")) }
    @PluginMethod fun cancelImageUpload(call: PluginCall) = execute(call, database.images) { cancel(string(call, "uploadId")) }
    @PluginMethod fun getImageRotation(call: PluginCall) = execute(call, database.images) { rotation() }
    @PluginMethod fun updateImageRotation(call: PluginCall) = execute(call, database.images) { updateRotation(body(call)) }
    @PluginMethod fun getImageBackground(call: PluginCall) = execute(call, database.images) { background(query(call)) }
    @PluginMethod fun bindImageBackground(call: PluginCall) = execute(call, database.images) { bind(body(call)) }
    @PluginMethod fun randomImage(call: PluginCall) = execute(call, database.images) { random(string(call, "random"), query(call)) }

    private fun <Service : Any> execute(call: PluginCall, service: Service, action: suspend Service.() -> JSObject) {
        scope.launch {
            try {
                call.resolve(database.access(service, call.getString("authToken"), action))
            } catch (error: CancellationException) {
                throw error
            } catch (error: LocalApiException) {
                call.reject(error.message, error.code)
            } catch (error: Exception) {
                call.reject("本地数据库操作失败", "DATABASE_ERROR", error)
            }
        }
    }

    private fun body(call: PluginCall): JSObject = call.getObject("data")
        ?: throw LocalApiException("data 必须是对象")

    private fun query(call: PluginCall): JSObject = if (call.data.has("query"))
        call.getObject("query") ?: throw LocalApiException("query 必须是对象") else JSObject()

    private fun string(call: PluginCall, key: String): String = call.getString(key)
        ?: throw LocalApiException("$key 必须是字符串")

    private fun id(call: PluginCall): Long {
        val value = (call.data.opt("id") as? Number)?.toDouble()
            ?: throw LocalApiException("id 必须是正整数")
        if (!value.isFinite() || value < 1 || value > 9007199254740991.0 || value % 1.0 != 0.0) {
            throw LocalApiException("id 必须是正整数")
        }
        return value.toLong()
    }

    override fun handleOnDestroy() {
        scope.cancel()
    }
}
