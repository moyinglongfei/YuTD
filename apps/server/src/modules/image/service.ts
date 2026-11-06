import { randomUUID } from 'node:crypto'
import { mkdir, open, rename, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { BadRequestException, NotFoundException } from 'elysia-http-exception'
import type { Image } from '#prisma/client'
import { prisma } from '#backend/lib/prisma'
import { serverDirectory } from '#backend/lib/paths'
import { MAX_IMAGE_BYTES, type ImageList, type ImageListQuery, type StoredImage, type ImageRotation } from '#shared/images'
import { ImageBackgroundService } from './background'

const directory = join(serverDirectory, 'uploads/images')
const formats = {
  jpeg: { mimeType: 'image/jpeg', extension: 'jpg' },
  png: { mimeType: 'image/png', extension: 'png' },
  webp: { mimeType: 'image/webp', extension: 'webp' },
  gif: { mimeType: 'image/gif', extension: 'gif' },
  avif: { mimeType: 'image/avif', extension: 'avif' },
} as const
const locks = new Map<string, Promise<void>>()
const imageOptions = { maxPixels: 80_000_000, autoOrient: true } as const
const fullPath = (record: Image) => join(directory, `${record.id}.${record.extension}`)
const thumbnailPath = (id: string) => join(directory, `${id}.thumb.png`)
const legacyThumbnailPath = (id: string) => join(directory, `${id}.thumb.webp`)
const missing = (error: unknown) => Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')

async function locked<T>(id: string, action: () => Promise<T>) {
  const previous = locks.get(id)
  let release!: () => void
  const current = new Promise<void>((resolve) => { release = resolve })
  locks.set(id, current)
  await previous
  try {
    return await action()
  } finally {
    release()
    if (locks.get(id) === current) locks.delete(id)
  }
}

async function saveFile(path: string, bytes: Uint8Array) {
  const file = await open(path, 'wx')
  try {
    await file.writeFile(bytes)
  } catch (error) {
    await file.close()
    await unlink(path).catch(() => {})
    throw error
  }
  await file.close()
}

function imagePipeline(bytes: Uint8Array) {
  return new Bun.Image(bytes, imageOptions)
}

function imageError(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
  if (code === 'ERR_IMAGE_TOO_MANY_PIXELS')
    return new BadRequestException('图片尺寸超过 8000 万像素')
  if (code === 'ERR_IMAGE_FORMAT_UNSUPPORTED')
    return new BadRequestException('当前系统的 Bun 图片后端不支持该格式，请换用 JPEG、PNG、WebP 或 GIF')
  return new BadRequestException('图片无法解码，请换一张有效图片')
}

function metadata(record: Image & { backgrounds?: { backgroundKey: string }[] }): StoredImage {
  const { id, name, mimeType, size, width, height, createdAt, thumbnailSize, thumbnailWidth, thumbnailHeight } = record
  return {
    id, name, mimeType, size, width, height,
    originalSize: record.originalSize ?? size,
    createdAt: createdAt.toISOString(),
    url: `/api/image/${id}/file`,
    thumbnailUrl: `/api/image/${id}/thumbnail`,
    thumbnailSize, thumbnailWidth, thumbnailHeight,
    backgroundKeys: record.backgrounds?.map(value => value.backgroundKey) ?? [],
  }
}

export { metadata as imageMetadata }

function rotation(records: Image[]): ImageRotation {
  return {
    items: records.map(record => ({ image: metadata(record), enabled: record.randomEnabled, position: record.queuePosition })),
    total: records.filter(record => record.randomEnabled).length,
    remaining: records.filter(record => record.randomEnabled && record.queuePosition !== null).length
  }
}

export abstract class ImageService {
  static async rotation() {
    return rotation(await ImageBackgroundService.rotation())
  }

  static async updateRotation(images: { id: string, enabled: boolean }[], reshuffle = false) {
    return rotation(await ImageBackgroundService.updateRotation(images, reshuffle))
  }

  static async upload(file: File, thumbnail: File) {
    if ([file, thumbnail].some(image => !image.size || image.size > MAX_IMAGE_BYTES))
      throw new BadRequestException('请选择不超过 20 MB 的图片')
    const bytes = new Uint8Array(await file.arrayBuffer())
    const thumbnailBytes = new Uint8Array(await thumbnail.arrayBuffer())
    let dimensions: Bun.Image.Metadata
    let thumbnailInfo: Bun.Image.Metadata
    try {
      dimensions = await imagePipeline(bytes).metadata()
      thumbnailInfo = await imagePipeline(thumbnailBytes).metadata()
    } catch (error) {
      throw imageError(error)
    }
    if (!(dimensions.format in formats))
      throw new BadRequestException('支持 JPEG、PNG、WebP、GIF 和 AVIF 图片')
    if (thumbnailInfo.format !== 'png')
      throw new BadRequestException('简化图必须为 PNG 图片')
    const { width, height } = dimensions
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || width * height > 80_000_000)
      throw new BadRequestException('图片尺寸无效或超过 8000 万像素')
    const format = formats[dimensions.format as keyof typeof formats]
    const id = randomUUID()
    const name = file.name.replace(/\\/g, '/').split('/').at(-1)?.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 240) || `image.${format.extension}`
    await mkdir(directory, { recursive: true })
    const written: string[] = []
    try {
      const path = join(directory, `${id}.${format.extension}`)
      await saveFile(path, bytes)
      written.push(path)
      const thumb = thumbnailPath(id)
      await saveFile(thumb, thumbnailBytes)
      written.push(thumb)
      return metadata(await ImageBackgroundService.create({
          id, name, ...format, size: bytes.byteLength, originalSize: bytes.byteLength, width, height,
          thumbnailSize: thumbnailBytes.byteLength,
          thumbnailWidth: thumbnailInfo.width,
          thumbnailHeight: thumbnailInfo.height,
      }))
    } catch (error) {
      await Promise.allSettled(written.map(path => unlink(path)))
      throw error
    }
  }

  static async list(query: ImageListQuery = {}): Promise<ImageList> {
    const limit = query.limit ?? 24
    const offset = query.offset ?? 0
    const search = query.search?.trim()
    const where = search ? { name: { contains: search } } : {}
    const [records, total] = await prisma.$transaction([
      prisma.image.findMany({ where, take: limit, skip: offset, include: { backgrounds: { select: { backgroundKey: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
      prisma.image.count({ where }),
    ])
    return { items: records.map(metadata), total, limit, offset }
  }

  static async record(id: string) {
    const record = await prisma.image.findUnique({ where: { id }, include: { backgrounds: { select: { backgroundKey: true } } } })
    if (!record) throw new NotFoundException('图片不存在')
    return record
  }

  static async get(id: string) {
    return metadata(await this.record(id))
  }

  static async file(id: string) {
    const record = await this.record(id)
    return this.response(record, false)
  }

  static async thumbnail(id: string) {
    return this.response(await this.record(id), true)
  }

  private static async response(record: Image, thumbnail: boolean) {
    let path = thumbnail ? thumbnailPath(record.id) : fullPath(record)
    if (thumbnail && !await Bun.file(path).exists()) path = legacyThumbnailPath(record.id)
    const file = Bun.file(path)
    if (!await file.exists()) throw new NotFoundException('图片文件不存在')
    const stem = record.name.replace(/\.[^.]+$/, '') || 'image'
    const filename = thumbnail ? `${stem}.thumb.${path.endsWith('.png') ? 'png' : 'webp'}` : `${stem}.${record.extension}`
    return new Response(file, {
      headers: {
        'content-type': thumbnail ? file.type : record.mimeType,
        'content-length': String(file.size),
        'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    })
  }

  static async remove(id: string) {
    return locked(id, async () => {
      const record = await this.record(id)
      const staged: [string, string][] = []
      try {
        // 暂存待删除文件，数据库删除失败时可还原。
        for (const path of [fullPath(record), thumbnailPath(id), legacyThumbnailPath(id)]) {
          const temporary = `${path}.deleting-${randomUUID()}`
          try {
            await rename(path, temporary)
            staged.push([path, temporary])
          } catch (error) {
            if (!missing(error)) throw error
          }
        }
        await ImageBackgroundService.remove(id)
      } catch (error) {
        const restored = await Promise.allSettled(staged.map(([path, temporary]) => rename(temporary, path)))
        for (const result of restored) if (result.status === 'rejected') console.error('还原图片文件失败', result.reason)
        throw error
      }
      const removed = await Promise.allSettled(staged.map(([, temporary]) => unlink(temporary)))
      for (const result of removed) if (result.status === 'rejected') console.error('清理已删除图片失败', result.reason)
      return { id }
    })
  }
}
