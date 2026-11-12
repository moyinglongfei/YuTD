package com.yutd.app.local.resource

import com.yutd.app.local.LocalDatabase
import com.yutd.app.local.utils.*
import com.getcapacitor.JSObject
import org.json.JSONObject
import java.time.*
import com.yutd.app.local.phase.*
import com.yutd.app.local.event.*
import com.yutd.app.local.eventschedule.*
import com.yutd.app.local.task.*
import com.yutd.app.local.tip.*
import com.yutd.app.local.style.*
import com.yutd.app.local.image.*

class ResourceService internal constructor(private val database: LocalDatabase) {
    suspend fun list(query: JSONObject): JSObject = database.read {
        query.checked(setOf("type", "sort", "search", "tag", "limit", "offset"))
        val types = resourceTypes
        val type = query.text("type", "all")
        val sort = query.text("sort", "updatedAt")
        if (type !in types + "all" || sort !in setOf("createdAt", "updatedAt")) throw LocalApiException("资源筛选参数无效")
        val search = query.text("search", "", min = 0, max = 120)
        val tag = query.text("tag", "", min = 0, max = 120)
        val limit = query.number("limit", 24, max = 100, query = true).toInt()
        val offset = query.number("offset", 0, min = 0, max = Int.MAX_VALUE.toLong(), query = true).toInt()
        val items = mutableListOf<JSObject>()
        fun selected(kind: String) = (type == "all" || type == kind) && (tag.isEmpty() || kind == "task")
        fun contains(vararg values: String?) = search.isEmpty() || values.any { it?.contains(search, ignoreCase = true) == true }
        fun add(kind: String, id: Any, title: String, created: String, updated: String, data: JSObject, tags: List<String> = emptyList()) {
            items.add(obj("id" to "$kind:$id", "type" to kind, "title" to title, "createdAt" to created,
                "updatedAt" to updated, "tags" to arr(tags), "data" to data))
        }
        if (selected("image")) database.images.records().filter { contains(it.name, it.id) }.forEach {
            add("image", it.id, it.name, it.createdAt, it.createdAt, database.images.metadata(it).apply { put("backgroundKeys", arr(emptyList<String>())) })
        }
        val tags = database.tasks.tags()
        val searchedTasks = if (type == "all" || type == "task") database.tasks.records().filter { value ->
            contains(value.title, value.description, tags.filter { it.taskId == value.id }.joinToString(" ") { it.name }, value.eventId?.let { database.events.require(it).name })
        } else emptyList()
        if (selected("task")) searchedTasks.filter { value -> tag.isEmpty() || tags.any { it.taskId == value.id && it.name == tag } }.forEach { value ->
            add("task", value.id, value.title, value.createdAt, value.updatedAt, database.tasks.data(value), tags.filter { it.taskId == value.id }.map { it.name })
        }
        if (selected("event")) database.events.records().filter { contains(it.name, it.organizer, it.location) }.forEach {
            val data = it.toJson().apply {
                put("phase", database.phases.require(it.phaseId).toJson())
                put("schedules", arr(database.schedules.records().filter { value -> value.eventId == it.id }.map { value -> value.toJson() }))
            }
            add("event", it.id, it.name, it.createdAt, it.updatedAt, data)
        }
        if (selected("phase")) database.phases.records().filter { contains(it.name) }.forEach { add("phase", it.id, it.name, it.createdAt, it.updatedAt, it.toJson()) }
        if (selected("tip")) database.tips.records().filter { contains(it.content) }.forEach { add("tip", it.id, it.content, it.createdAt, it.updatedAt, it.toJson()) }
        if (selected("style")) database.styles.records().filter { contains(it.name, it.fontFamily) }.forEach { add("style", it.id, it.name, it.createdAt, it.updatedAt, it.toJson()) }
        items.sortWith { left, right ->
            var difference = Instant.parse(right.getString(sort)).compareTo(Instant.parse(left.getString(sort)))
            if (difference == 0) difference = Instant.parse(right.getString("createdAt")).compareTo(Instant.parse(left.getString("createdAt")))
            if (difference == 0) difference = types.indexOf(left.getString("type")) - types.indexOf(right.getString("type"))
            if (difference == 0) {
                val a = left.getJSONObject("data").get("id")
                val b = right.getJSONObject("data").get("id")
                difference = if (a is Number && b is Number) b.toLong().compareTo(a.toLong()) else b.toString().compareTo(a.toString())
            }
            difference
        }
        val searchedIds = searchedTasks.map { it.id }.toSet()
        val tagCounts = tags.filter { it.taskId in searchedIds }.groupingBy { it.name }.eachCount().toSortedMap()
        obj("items" to arr(items.drop(offset).take(limit)), "total" to items.size, "limit" to limit, "offset" to offset,
            "tags" to arr(tagCounts.map { obj("name" to it.key, "count" to it.value) }))
    }
}
