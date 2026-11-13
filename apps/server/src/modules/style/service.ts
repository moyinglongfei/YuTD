import { BadRequestException, NotFoundException } from 'elysia-http-exception'
import { prisma } from '#backend/lib/prisma'
import stylePresets from '#shared/assets/style-presets.json'
import type { StyleModelType } from './model'

function toStyle(record: Awaited<ReturnType<typeof prisma.style.findFirstOrThrow>>) {
  const { id, name, showMode, backgroundPrimary, backgroundSecondary, textPrimary, textSecondary, fontFamily } = record
  return { id, name, showMode: showMode as 0 | 1, backgroundPrimary, backgroundSecondary, textPrimary, textSecondary, fontFamily }
}
function normalize(data: StyleModelType['update']) {
  const value = { ...data }
  for (const key of ['name', 'fontFamily'] as const) {
    if (value[key] !== undefined) {
      value[key] = value[key].trim()
      if (!value[key])
        throw new BadRequestException('样式名称和字体不能为空')
    }
  }
  return value
}
export abstract class StyleService {
  static async ensureStyle() {
    const current = await prisma.style.findFirst({ orderBy: { id: 'asc' } })
    if (current) return current
    return prisma.$transaction(async (tx) => {
      const existing = await tx.style.findFirst({ orderBy: { id: 'asc' } })
      if (existing) return existing
      await tx.style.createMany({ data: stylePresets })
      return tx.style.findFirstOrThrow({ orderBy: { id: 'asc' } })
    })
  }
  static async list() {
    await this.ensureStyle()
    return (await prisma.style.findMany({ orderBy: { id: 'asc' } })).map(toStyle)
  }
  static async get(id: number) {
    const style = await prisma.style.findUnique({ where: { id } })
    if (!style)
      throw new NotFoundException('样式预设不存在')
    return toStyle(style)
  }
  static async create(data: StyleModelType['create']) {
    return toStyle(await prisma.style.create({ data: { ...data, ...normalize(data) } }))
  }
  static async update(id: number, data: StyleModelType['update']) {
    await this.get(id)
    return toStyle(await prisma.style.update({ where: { id }, data: normalize(data) }))
  }
}
