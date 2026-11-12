package com.yutd.app.local.utils

import com.getcapacitor.JSObject
import org.json.JSONObject
import org.json.JSONArray

internal fun obj(vararg values: Pair<String, Any?>): JSObject = JSObject().apply {
    values.forEach { (key, value) -> put(key, value ?: JSONObject.NULL) }
}
internal fun arr(values: Iterable<*>): JSONArray = JSONArray(values.toList())
