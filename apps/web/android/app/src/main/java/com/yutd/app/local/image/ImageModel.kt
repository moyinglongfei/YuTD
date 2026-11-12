package com.yutd.app.local.image

import com.yutd.app.local.utils.*
import java.time.*
import androidx.room.*
import java.io.File

@Entity(tableName = "images", indices = [Index("createdAt"), Index("queuePosition")])
data class ImageRecord(@PrimaryKey val id: String, val name: String, val mimeType: String, val extension: String,
    val size: Long, val width: Int, val height: Int, val thumbnailSize: Long, val thumbnailWidth: Int, val thumbnailHeight: Int,
    val createdAt: String = Instant.now().toString(), val queuePosition: Int? = null, val randomEnabled: Boolean = true)

@Entity(tableName = "image_backgrounds", foreignKeys = [ForeignKey(entity = ImageRecord::class,
    parentColumns = ["id"], childColumns = ["imageId"], onDelete = ForeignKey.CASCADE)], indices = [Index("imageId")])
data class BackgroundRecord(@PrimaryKey val backgroundKey: String, val imageId: String, val position: String? = null)

internal data class ImageUpload(val name: String, val size: Long, val thumbnailSize: Long, val file: File, val thumbnail: File)

@Dao
interface ImageDao {
    @Query("SELECT * FROM images ORDER BY createdAt DESC, id ASC") suspend fun images(): List<ImageRecord>
    @Query("SELECT * FROM images WHERE id = :id") suspend fun image(id: String): ImageRecord?
    @Insert suspend fun insertImage(value: ImageRecord)
    @Update suspend fun saveImage(value: ImageRecord)
    @Query("DELETE FROM images WHERE id = :id") suspend fun deleteImage(id: String)
    @Query("SELECT * FROM image_backgrounds WHERE backgroundKey = :key") suspend fun background(key: String): BackgroundRecord?
    @Query("SELECT * FROM image_backgrounds WHERE imageId = :id ORDER BY backgroundKey") suspend fun backgrounds(id: String): List<BackgroundRecord>
    @Upsert suspend fun saveBackground(value: BackgroundRecord)
}
