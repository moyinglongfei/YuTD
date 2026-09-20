import type { Prisma } from '#prisma/client'
import { BadRequestException, NotFoundException } from 'elysia-http-exception'
import { prisma } from '#backend/lib/prisma'
import type { TipModelType } from './model'

function validateDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)
    || Number.isNaN(date.getTime())
    || date.toISOString().slice(0, 10) !== value)
    throw new BadRequestException('日期必须是有效的 YYYY-MM-DD')
  return value
}

function toRelations(ids: number[] | undefined, replaceCollections: boolean) {
  if (ids === undefined)
    return undefined
  const references = [...new Set(ids)].map(id => ({ id }))
  return replaceCollections ? { set: references } : { connect: references }
}

function toPrismaData(data: TipModelType['update'], replaceCollections = false) {
  if (data.content !== undefined && !data.content.trim())
    throw new BadRequestException('提示内容不能为空')

  return {
    content: data.content,
    dates: data.dates === undefined
      ? undefined
      : {
          ...(replaceCollections ? { deleteMany: {} } : {}),
          create: [...new Set(data.dates.map(validateDate))].map(date => ({ date })),
        },
    events: toRelations(data.eventIds, replaceCollections),
    phases: toRelations(data.phaseIds, replaceCollections),
    tasks: toRelations(data.taskIds, replaceCollections),
  }
}

async function validateRelations(tx: Prisma.TransactionClient, data: TipModelType['update']) {
  const [events, phases, tasks] = await Promise.all([
    data.eventIds?.length
      ? tx.event.findMany({ where: { id: { in: data.eventIds } }, select: { id: true } })
      : [],
    data.phaseIds?.length
      ? tx.phase.findMany({ where: { id: { in: data.phaseIds } }, select: { id: true } })
      : [],
    data.taskIds?.length
      ? tx.task.findMany({ where: { id: { in: data.taskIds } }, select: { id: true } })
      : [],
  ])

  if (events.length !== new Set(data.eventIds).size)
    throw new BadRequestException('关联事件不存在')
  if (phases.length !== new Set(data.phaseIds).size)
    throw new BadRequestException('关联阶段不存在')
  if (tasks.length !== new Set(data.taskIds).size)
    throw new BadRequestException('关联任务不存在')
}

const tipInclude = {
  dates: { orderBy: { date: 'asc' as const } },
  events: { orderBy: { id: 'asc' as const } },
  phases: { orderBy: { id: 'asc' as const } },
  tasks: { orderBy: { id: 'asc' as const } },
}

export abstract class TipService {
  static findMany(filters: TipModelType['query']) {
    const where: Prisma.TipWhereInput = {}
    if (filters.date)
      where.dates = { some: { date: validateDate(filters.date) } }
    if (filters.eventId)
      where.events = { some: { id: filters.eventId } }
    if (filters.phaseId)
      where.phases = { some: { id: filters.phaseId } }
    if (filters.taskId)
      where.tasks = { some: { id: filters.taskId } }

    return prisma.tip.findMany({
      where,
      include: tipInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
  }

  static async getById(id: number) {
    const tip = await prisma.tip.findUnique({ where: { id }, include: tipInclude })
    if (!tip)
      throw new NotFoundException('提示不存在')
    return tip
  }

  static create(data: TipModelType['create']) {
    return prisma.$transaction(async (tx) => {
      await validateRelations(tx, data)
      const now = new Date()
      return tx.tip.create({
        data: {
          ...toPrismaData(data),
          content: data.content,
          createdAt: now,
          updatedAt: now,
        },
        include: tipInclude,
      })
    })
  }

  static update(id: number, data: TipModelType['update']) {
    return prisma.$transaction(async (tx) => {
      const tip = await tx.tip.findUnique({ where: { id } })
      if (!tip)
        throw new NotFoundException('提示不存在')
      await validateRelations(tx, data)

      return tx.tip.update({
        where: { id },
        data: {
          ...toPrismaData(data, true),
          updatedAt: data.content !== undefined && data.content !== tip.content
            ? new Date()
            : undefined,
        },
        include: tipInclude,
      })
    })
  }

  static delete(id: number) {
    return prisma.$transaction(async (tx) => {
      const tip = await tx.tip.findUnique({ where: { id } })
      if (!tip)
        throw new NotFoundException('提示不存在')
      return tx.tip.delete({ where: { id } })
    })
  }
}
