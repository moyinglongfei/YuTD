package com.yutd.app.local.image

import com.yutd.app.local.LocalDatabase
import com.yutd.app.local.utils.*
import android.content.Context
import android.graphics.BitmapFactory
import android.media.ExifInterface
import android.net.Uri
import android.util.Base64
import com.getcapacitor.JSObject
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject
import java.io.File
import java.math.BigInteger
import java.util.UUID

class ImageService internal constructor(context: Context, private val database: LocalDatabase) {
    private val dao = database.imageDao()
    private val directory = File(context.filesDir, "images").apply { mkdirs() }
    private val temporary = File(context.cacheDir, "image-uploads").apply { mkdirs() }
    private val mutex = Mutex()
    private val uploads = mutableMapOf<String, ImageUpload>()

    internal suspend fun records(): List<ImageRecord> = dao.images()

    internal suspend fun metadata(value: ImageRecord): JSObject = obj("id" to value.id, "name" to value.name,
        "mimeType" to value.mimeType, "size" to value.size, "originalSize" to value.size, "width" to value.width,
        "height" to value.height, "createdAt" to value.createdAt, "url" to "/api/image/${value.id}/file",
        "thumbnailUrl" to "/api/image/${value.id}/thumbnail", "thumbnailSize" to value.thumbnailSize,
        "thumbnailWidth" to value.thumbnailWidth, "thumbnailHeight" to value.thumbnailHeight,
        "backgroundKeys" to arr(dao.backgrounds(value.id).map { it.backgroundKey }))
    private fun uuid(value: String): String {
        if (!Regex("(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$").matches(value)) throw LocalApiException("图片 ID 无效")
        return value
    }
    private suspend fun image(id: String): ImageRecord = dao.image(uuid(id)) ?: throw LocalApiException("图片不存在", "NOT_FOUND")
    private fun full(value: ImageRecord) = File(directory, "${value.id}.${value.extension}")
    private fun thumb(id: String) = File(directory, "$id.thumb.png")

    suspend fun begin(data: JSONObject): JSObject = mutex.withLock {
        data.checked(setOf("name", "size", "thumbnailSize"), setOf("name", "size", "thumbnailSize"))
        val name = data.text("name", trim = false, min = 0).replace('\\', '/').substringAfterLast('/').replace(Regex("[\\x00-\\x1f\\x7f]"), "").take(240).ifEmpty { "image" }
        val size = data.number("size", max = MAX_BYTES)
        val thumbnailSize = data.number("thumbnailSize", max = MAX_BYTES)
        temporary.listFiles()?.filter { System.currentTimeMillis() - it.lastModified() > 3600000 }?.forEach { it.delete() }
        val id = UUID.randomUUID().toString()
        uploads[id] = ImageUpload(name, size, thumbnailSize, File(temporary, "$id.original"), File(temporary, "$id.thumbnail"))
        obj("uploadId" to id)
    }
    suspend fun append(data: JSONObject): JSObject = mutex.withLock {
        data.checked(setOf("uploadId", "part", "offset", "base64"), setOf("uploadId", "part", "offset", "base64"))
        val upload = uploads[data.text("uploadId")] ?: throw LocalApiException("上传已失效，请重新选择图片")
        val part = data.text("part")
        if (part !in setOf("file", "thumbnail")) throw LocalApiException("上传分片类型无效")
        val file = if (part == "file") upload.file else upload.thumbnail
        val expected = if (part == "file") upload.size else upload.thumbnailSize
        val offset = data.number("offset", min = 0, max = MAX_BYTES)
        val encoded = data.text("base64", max = 350000)
        val bytes = try { Base64.decode(encoded, Base64.NO_WRAP) } catch (_: Exception) { throw LocalApiException("上传分片编码无效") }
        if (file.length() != offset || bytes.isEmpty() || bytes.size > CHUNK_BYTES || offset + bytes.size > expected) throw LocalApiException("上传分片长度或顺序无效")
        file.appendBytes(bytes)
        obj("offset" to file.length())
    }
    suspend fun cancel(id: String): JSObject = mutex.withLock {
        uploads.remove(id)?.let { it.file.delete(); it.thumbnail.delete() }
        obj("cancelled" to true)
    }
    suspend fun finish(id: String): JSObject = mutex.withLock {
        val upload = uploads.remove(id) ?: throw LocalApiException("上传已失效，请重新选择图片")
        var original: File? = null
        var thumbnail: File? = null
        try {
            if (upload.file.length() != upload.size || upload.thumbnail.length() != upload.thumbnailSize) throw LocalApiException("图片上传不完整")
            val dimensions = dimensions(upload.file)
            val preview = dimensions(upload.thumbnail)
            if (preview.third != "image/png") throw LocalApiException("简化图必须为 PNG 图片")
            val extension = formats[dimensions.third] ?: throw LocalApiException("支持 JPEG、PNG、WebP、GIF 和设备能够解码的 AVIF 图片")
            val record = ImageRecord(UUID.randomUUID().toString(), upload.name, dimensions.third, extension, upload.size,
                dimensions.first, dimensions.second, upload.thumbnailSize, preview.first, preview.second, createdAt = now())
            original = full(record)
            thumbnail = thumb(record.id)
            move(upload.file, original)
            move(upload.thumbnail, thumbnail)
            database.write {
                queue()
                val positioned = record.copy(queuePosition = insertPosition())
                dao.insertImage(positioned)
                metadata(positioned)
            }
        } catch (error: Exception) {
            original?.delete(); thumbnail?.delete()
            throw error
        } finally { upload.file.delete(); upload.thumbnail.delete() }
    }
    private fun dimensions(file: File): Triple<Int, Int, String> {
        val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.absolutePath, options)
        var width = options.outWidth
        var height = options.outHeight
        if (width <= 0 || height <= 0 || width.toLong() * height > 80000000L) throw LocalApiException("图片无法解码或超过 8000 万像素")
        val orientation = try { ExifInterface(file.absolutePath).getAttributeInt(ExifInterface.TAG_ORIENTATION, 1) } catch (_: Exception) { 1 }
        if (orientation in setOf(5, 6, 7, 8)) { val previous = width; width = height; height = previous }
        return Triple(width, height, options.outMimeType ?: throw LocalApiException("图片格式无法识别"))
    }
    private fun move(source: File, target: File) {
        if (!source.renameTo(target)) { source.copyTo(target, overwrite = false); if (!source.delete()) throw java.io.IOException("临时图片清理失败") }
    }
    suspend fun list(query: JSONObject): JSObject = database.read {
        query.checked(setOf("limit", "offset", "search"))
        val limit = query.number("limit", 24, max = 100, query = true).toInt()
        val offset = query.number("offset", 0, min = 0, max = Int.MAX_VALUE.toLong(), query = true).toInt()
        val search = query.text("search", "", min = 0, max = 120)
        val records = dao.images().filter { it.name.contains(search, ignoreCase = true) }.sortedWith(compareByDescending<ImageRecord> { it.createdAt }.thenByDescending { it.id })
        obj("items" to arr(records.drop(offset).take(limit).map { metadata(it) }), "total" to records.size, "limit" to limit, "offset" to offset)
    }
    suspend fun get(id: String): JSObject = database.read { metadata(image(id)) }
    suspend fun file(id: String, thumbnail: Boolean): JSObject = database.read {
        val record = image(id)
        val path = if (thumbnail) thumb(id) else full(record)
        if (!path.isFile) throw LocalApiException("图片文件不存在", "NOT_FOUND")
        obj("uri" to Uri.fromFile(path).toString(), "mimeType" to if (thumbnail) "image/png" else record.mimeType,
            "name" to if (thumbnail) "${record.name.substringBeforeLast('.')}.thumb.png" else record.name)
    }
    suspend fun remove(id: String): JSObject = mutex.withLock {
        val record = database.read { image(id) }
        val staged = mutableListOf<Pair<File, File>>()
        try {
            for (file in listOf(full(record), thumb(id))) {
                if (!file.exists()) continue
                val target = File(directory, "${file.name}.deleting-${UUID.randomUUID()}")
                if (!file.renameTo(target)) throw java.io.IOException("图片文件正在使用，无法删除")
                staged.add(file to target)
            }
            database.write { dao.deleteImage(id) }
        } catch (error: Exception) {
            staged.forEach { (original, temporary) -> temporary.renameTo(original) }
            throw error
        }
        staged.forEach { (_, temporary) -> temporary.delete() }
        obj("id" to id)
    }
    private suspend fun queue(): List<ImageRecord> {
        val records = dao.images()
        val remaining = records.filter { it.randomEnabled && it.queuePosition != null }.sortedWith(compareBy<ImageRecord> { it.queuePosition }.thenBy { it.id })
        if (remaining.isNotEmpty()) return remaining
        return records.filter { it.randomEnabled }.shuffled(java.security.SecureRandom()).mapIndexed { index, value ->
            value.copy(queuePosition = index).also { dao.saveImage(it) }
        }
    }
    private suspend fun insertPosition(): Int {
        val remaining = dao.images().filter { it.randomEnabled && it.queuePosition != null }.sortedBy { it.queuePosition }
        val slot = java.security.SecureRandom().nextInt(remaining.size + 1)
        val position = remaining.getOrNull(slot)?.queuePosition ?: ((remaining.lastOrNull()?.queuePosition ?: -1) + 1)
        remaining.filter { it.queuePosition!! >= position }.forEach { dao.saveImage(it.copy(queuePosition = it.queuePosition!! + 1)) }
        return position
    }
    private suspend fun rotationJson(): JSObject {
        val records = dao.images()
        return obj("items" to arr(records.map { obj("image" to metadata(it), "enabled" to it.randomEnabled, "position" to it.queuePosition) }),
            "total" to records.count { it.randomEnabled }, "remaining" to records.count { it.randomEnabled && it.queuePosition != null })
    }
    suspend fun rotation(): JSObject = database.read { rotationJson() }
    suspend fun updateRotation(data: JSONObject): JSObject = mutex.withLock { database.write {
        data.checked(setOf("images", "reshuffle"), setOf("images"))
        val items = data.objects("images")
        val ids = items.map { it.checked(setOf("id", "enabled"), setOf("id", "enabled")); uuid(it.text("id")) }
        if (ids.distinct().size != ids.size) throw LocalApiException("轮播图片不能重复")
        ids.forEach { image(it) }
        val reshuffle = data.flag("reshuffle")
        items.forEach { item ->
            val record = image(item.text("id"))
            val enabled = item.flag("enabled")
            if (!enabled) dao.saveImage(record.copy(randomEnabled = false, queuePosition = null))
        }
        items.filter { it.flag("enabled") }.forEach {
            val record = image(it.text("id"))
            if (!record.randomEnabled) dao.saveImage(record.copy(randomEnabled = true, queuePosition = if (reshuffle) null else insertPosition()))
        }
        if (reshuffle) {
            dao.images().filter { it.randomEnabled }.forEach { dao.saveImage(it.copy(queuePosition = null)) }
            queue()
        }
        rotationJson()
    } }
    private fun backgroundKey(value: String): String {
        if (value.isEmpty() || value.length > 240) throw LocalApiException("背景标识长度必须在 1 到 240 之间")
        return value
    }
    private fun selection(value: BackgroundRecord) = obj("backgroundKey" to value.backgroundKey, "id" to value.imageId,
        "position" to value.position?.let { JSONObject(it) })
    suspend fun background(query: JSONObject): JSObject = database.read {
        query.checked(setOf("backgroundKey"), setOf("backgroundKey"))
        val key = backgroundKey(query.text("backgroundKey", trim = false))
        dao.background(key)?.let { selection(it) } ?: obj("backgroundKey" to key, "id" to null, "position" to null)
    }
    suspend fun bind(data: JSONObject): JSObject = mutex.withLock { database.write {
        data.checked(setOf("backgroundKey", "imageId", "position"), setOf("backgroundKey", "imageId"))
        val key = backgroundKey(data.text("backgroundKey", trim = false))
        val id = image(data.text("imageId")).id
        val position = if (data.has("position")) {
            val value = data.opt("position") as? JSONObject ?: throw LocalApiException("裁剪参数必须是对象")
            value.checked(setOf("originalWidth", "originalHeight", "x", "y", "width", "height"), setOf("originalWidth", "originalHeight", "x", "y", "width", "height"))
            val numbers = value.keys().asSequence().associateWith { (value.get(it) as? Number)?.toDouble() ?: throw LocalApiException("裁剪参数必须是数字") }
            if (numbers.any { !it.value.isFinite() || it.value < 0 || (it.key !in setOf("x", "y") && it.value == 0.0) }
                || numbers.getValue("x") + numbers.getValue("width") > numbers.getValue("originalWidth")
                || numbers.getValue("y") + numbers.getValue("height") > numbers.getValue("originalHeight")) throw LocalApiException("背景裁剪区域超出图片范围")
            value.toString()
        } else null
        val value = BackgroundRecord(key, id, position)
        dao.saveBackground(value)
        selection(value)
    } }
    suspend fun random(random: String, query: JSONObject): JSObject = mutex.withLock { database.read {
        if (!Regex("^\\d{1,20}$").matches(random)) throw LocalApiException("随机编号格式无效")
        query.checked(setOf("backgroundKey"))
        val key = if (query.has("backgroundKey")) backgroundKey(query.text("backgroundKey", trim = false)) else null
        val saved = key?.let { dao.background(it) }
        if (saved != null) {
            val randomKey = "random-${saved.imageId}"
            if (dao.background(randomKey) == null) dao.saveBackground(BackgroundRecord(randomKey, saved.imageId))
            selection(saved).apply { put("backgroundKey", randomKey) }
        } else {
            val remaining = queue()
            if (remaining.isEmpty()) obj("id" to null, "backgroundKey" to null, "position" to null) else {
                val value = remaining[BigInteger(random).mod(BigInteger.valueOf(remaining.size.toLong())).toInt()]
                dao.saveImage(value.copy(queuePosition = null))
                val randomKey = "random-${value.id}"
                for (target in setOfNotNull(randomKey, key)) {
                    val previous = dao.background(target)
                    dao.saveBackground(BackgroundRecord(target, value.id, previous?.position))
                }
                database.versions.increment()
                obj("id" to value.id, "backgroundKey" to randomKey, "position" to null)
            }
        }
    } }
    companion object {
        const val MAX_BYTES = 20L * 1024 * 1024
        const val CHUNK_BYTES = 256 * 1024
        private val formats = mapOf("image/jpeg" to "jpg", "image/png" to "png", "image/webp" to "webp", "image/gif" to "gif", "image/avif" to "avif")
    }
}
