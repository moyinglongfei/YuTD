import { randomInt } from 'node:crypto'
import { BadRequestException, NotFoundException } from 'elysia-http-exception'
import { Prisma } from '#prisma/client'
import type { ImagePosition } from '#shared/images'
import { prisma } from '#backend/lib/prisma'

let pending: Promise<unknown> = Promise.resolve()
function serial<T>(action: () => Promise<T>): Promise<T> {
  const result = pending.then(action)
  pending = result.catch(() => {})
  return result
}

async function queue(tx: Prisma.TransactionClient) {
  const remaining = await tx.image.findMany({ where: { randomEnabled: true, queuePosition: { not: null } }, orderBy: [{ queuePosition: 'asc' }, { id: 'asc' }], select: { id: true, queuePosition: true } })
  if (remaining.length) return remaining
  const images = await tx.image.findMany({ where: { randomEnabled: true }, orderBy: { id: 'asc' }, select: { id: true } })
  for (let index = images.length - 1; index > 0; index--) {
    const other = randomInt(index + 1)
    const image = images[index]!
    images[index] = images[other]!
    images[other] = image
  }
  for (const [index, image] of images.entries())
    await tx.image.update({ where: { id: image.id }, data: { queuePosition: index } })
  return images.map((image, index) => ({ id: image.id, queuePosition: index }))
}

async function insertPosition(tx: Prisma.TransactionClient) {
  const remaining = await tx.image.findMany({ where: { randomEnabled: true, queuePosition: { not: null } }, orderBy: { queuePosition: 'asc' }, select: { queuePosition: true } })
  const slot = randomInt(remaining.length + 1)
  const position = slot < remaining.length ? remaining[slot]!.queuePosition! : (remaining.at(-1)?.queuePosition ?? -1) + 1
  await tx.image.updateMany({ where: { randomEnabled: true, queuePosition: { gte: position } }, data: { queuePosition: { increment: 1 } } })
  return position
}

function selection(record: { backgroundKey: string, imageId: string, position: Prisma.JsonValue }) {
  return { backgroundKey: record.backgroundKey, id: record.imageId, position: record.position as unknown as ImagePosition | null }
}

export abstract class ImageBackgroundService {
  static rotation() {
    return serial(() => prisma.image.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] }))
  }

  static updateRotation(images: { id: string, enabled: boolean }[], reshuffle = false) {
    if (new Set(images.map(image => image.id)).size !== images.length)
      throw new BadRequestException('轮播图片不能重复')
    return serial(() => prisma.$transaction(async (tx) => {
      const records = await tx.image.findMany({ where: { id: { in: images.map(image => image.id) } }, select: { id: true, randomEnabled: true } })
      if (records.length !== images.length) throw new NotFoundException('部分图片已被删除，请重新加载')
      const previous = new Map(records.map(image => [image.id, image.randomEnabled]))
      const excluded = images.filter(image => !image.enabled).map(image => image.id)
      await tx.image.updateMany({ where: { id: { in: excluded } }, data: { randomEnabled: false, queuePosition: null } })
      for (const image of images) {
        if (image.enabled && !previous.get(image.id)) {
          const position = reshuffle ? null : await insertPosition(tx)
          await tx.image.update({ where: { id: image.id }, data: { randomEnabled: true, queuePosition: position } })
        }
      }
      if (reshuffle) {
        await tx.image.updateMany({ where: { randomEnabled: true }, data: { queuePosition: null } })
        await queue(tx)
      }
      return tx.image.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] })
    }))
  }

  static async get(backgroundKey: string) {
    const record = await prisma.imageBackground.findUnique({ where: { backgroundKey } })
    return record ? selection(record) : { backgroundKey, id: null, position: null }
  }

  static bind(backgroundKey: string, imageId: string, position?: ImagePosition) {
    if (position && (position.x + position.width > position.originalWidth || position.y + position.height > position.originalHeight))
      throw new BadRequestException('背景裁剪区域超出图片范围')
    return serial(() => prisma.$transaction(async (tx) => {
      if (!await tx.image.findUnique({ where: { id: imageId }, select: { id: true } }))
        throw new NotFoundException('图片不存在')
      const record = await tx.imageBackground.upsert({
        where: { backgroundKey },
        create: { backgroundKey, imageId, ...(position ? { position: { ...position } } : {}) },
        update: { imageId, position: position ? { ...position } : Prisma.DbNull }
      })
      return selection(record)
    }))
  }

  static random(random: string, backgroundKey?: string) {
    return serial(() => prisma.$transaction(async (tx) => {
      if (backgroundKey) {
        const saved = await tx.imageBackground.findUnique({ where: { backgroundKey } })
        if (saved) {
          const randomKey = `random-${saved.imageId}`
          await tx.imageBackground.upsert({ where: { backgroundKey: randomKey }, create: { backgroundKey: randomKey, imageId: saved.imageId }, update: {} })
          return { ...selection(saved), backgroundKey: randomKey }
        }
      }
      const remaining = await queue(tx)
      if (!remaining.length) return { id: null, backgroundKey: null, position: null }
      const index = Number(BigInt(random) % BigInt(remaining.length))
      const image = remaining[index]!
      await tx.image.update({ where: { id: image.id }, data: { queuePosition: null } })
      const randomKey = `random-${image.id}`
      for (const key of new Set([randomKey, ...(backgroundKey ? [backgroundKey] : [])])) {
        await tx.imageBackground.upsert({ where: { backgroundKey: key }, create: { backgroundKey: key, imageId: image.id }, update: { imageId: image.id } })
      }
      await tx.serverInfo.upsert({ where: { id: 1 }, create: { id: 1, version: 1n }, update: { version: { increment: 1n } } })
      return { id: image.id, backgroundKey: randomKey, position: null }
    }))
  }

  static create(data: Prisma.ImageCreateInput) {
    return serial(() => prisma.$transaction(async (tx) => {
      if (data.randomEnabled === false) return tx.image.create({ data })
      await queue(tx)
      const position = await insertPosition(tx)
      return tx.image.create({ data: { ...data, queuePosition: position } })
    }))
  }

  static remove(id: string) {
    return serial(() => prisma.image.delete({ where: { id } }))
  }
}
