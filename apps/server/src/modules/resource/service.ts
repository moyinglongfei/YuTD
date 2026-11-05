import type { Phase, Prisma, Style, Tip } from '#prisma/client'
import type { StoredImage } from '#shared/images'
import type { ResourceQuery, ResourceSort, ResourceType } from '#shared/resources'
import { RESOURCE_TYPES } from '#shared/resources'
import { prisma } from '#backend/lib/prisma'
import { imageMetadata } from '#backend/modules/image/service'
import { taskInclude, type TaskService } from '#backend/modules/task/service'

type EventData = Prisma.EventGetPayload<{ include: { phase: true, schedules: true } }>
type DataMap = {
  image: StoredImage
  task: Awaited<ReturnType<typeof TaskService.findMany>>[number]
  event: EventData
  phase: Phase
  tip: Tip
  style: Style
}
type Resource<K extends ResourceType> = {
  id: string
  type: K
  title: string
  createdAt: Date
  updatedAt: Date
  tags: string[]
  data: DataMap[K]
}
export type ManagedResource = { [K in ResourceType]: Resource<K> }[ResourceType]
type Batch = { items: ManagedResource[], total: number }

function resource<K extends ResourceType>(
  type: K,
  record: { id: string | number, createdAt: Date, updatedAt?: Date },
  title: string,
  data: DataMap[K],
  tags: string[] = []
): Resource<K> {
  return { id: `${type}:${record.id}`, type, title, createdAt: record.createdAt, updatedAt: record.updatedAt ?? record.createdAt, tags, data }
}

function orderBy(sort: ResourceSort) {
  return [
    ...(sort === 'updatedAt' ? [{ updatedAt: 'desc' as const }] : []),
    { createdAt: 'desc' as const },
    { id: 'desc' as const },
  ]
}

export abstract class ResourceService {
  static async list(query: ResourceQuery = {}) {
    const type = query.type ?? 'all'
    const sort = query.sort ?? 'updatedAt'
    const search = query.search?.trim() ?? ''
    const tag = query.tag?.trim() ?? ''
    const limit = query.limit ?? 24
    const offset = query.offset ?? 0
    // 每类只取足以参与当前页排序的前缀，合并后再统一分页。
    const take = offset + limit
    const selected = (kind: ResourceType) => (type === 'all' || type === kind) && (!tag || kind === 'task')
    const batches: Promise<Batch>[] = []
    const taskSearch: Prisma.TaskWhereInput = search ? { OR: [
      { title: { contains: search } }, { description: { contains: search } },
      { tags: { some: { name: { contains: search } } } },
      { event: { name: { contains: search } } },
    ] } : {}
    const taskWhere: Prisma.TaskWhereInput = tag
      ? { AND: [taskSearch, { tags: { some: { name: tag } } }] }
      : taskSearch

    if (selected('image')) batches.push((async () => {
      const where: Prisma.ImageWhereInput = search ? { OR: [{ name: { contains: search } }, { id: { contains: search } }] } : {}
      const [records, total] = await prisma.$transaction([
        prisma.image.findMany({ where, take, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
        prisma.image.count({ where }),
      ])
      return { items: records.map(value => resource('image', value, value.name, imageMetadata(value))), total }
    })())

    if (selected('task')) batches.push((async () => {
      const [records, total] = await prisma.$transaction([
        prisma.task.findMany({ where: taskWhere, include: taskInclude, take, orderBy: orderBy(sort) }),
        prisma.task.count({ where: taskWhere }),
      ])
      return {
        items: records.map(value => resource('task', value, value.title, { ...value, isDone: value.completed }, value.tags.map(tag => tag.name))), total,
      }
    })())

    if (selected('event')) batches.push((async () => {
      const where: Prisma.EventWhereInput = search ? { OR: [
        { name: { contains: search } }, { organizer: { contains: search } }, { location: { contains: search } },
      ] } : {}
      const [records, total] = await prisma.$transaction([
        prisma.event.findMany({ where, take, orderBy: orderBy(sort), include: {
          phase: true, schedules: { orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] },
        } }),
        prisma.event.count({ where }),
      ])
      return { items: records.map(value => resource('event', value, value.name, value)), total }
    })())

    if (selected('phase')) batches.push((async () => {
      const where: Prisma.PhaseWhereInput = search ? { name: { contains: search } } : {}
      const [records, total] = await prisma.$transaction([
        prisma.phase.findMany({ where, take, orderBy: orderBy(sort) }),
        prisma.phase.count({ where }),
      ])
      return { items: records.map(value => resource('phase', value, value.name, value)), total }
    })())

    if (selected('tip')) batches.push((async () => {
      const where: Prisma.TipWhereInput = search ? { content: { contains: search } } : {}
      const [records, total] = await prisma.$transaction([
        prisma.tip.findMany({ where, take, orderBy: orderBy(sort) }),
        prisma.tip.count({ where }),
      ])
      return { items: records.map(value => resource('tip', value, value.content, value)), total }
    })())

    if (selected('style')) batches.push((async () => {
      const where: Prisma.StyleWhereInput = search ? { OR: [{ name: { contains: search } }, { fontFamily: { contains: search } }] } : {}
      const [records, total] = await prisma.$transaction([
        prisma.style.findMany({ where, take, orderBy: orderBy(sort) }),
        prisma.style.count({ where }),
      ])
      return { items: records.map(value => resource('style', value, value.name, value)), total }
    })())

    const [results, tags] = await Promise.all([
      Promise.all(batches),
      type === 'all' || type === 'task'
        ? prisma.taskTag.groupBy({ by: ['name'], where: { task: taskSearch }, _count: { _all: true }, orderBy: { name: 'asc' } })
        : Promise.resolve([]),
    ])
    const items = results.flatMap(result => result.items)
    items.sort((a, b) => {
      const difference = b[sort].getTime() - a[sort].getTime() || b.createdAt.getTime() - a.createdAt.getTime()
      if (difference) return difference
      if (a.type !== b.type) return RESOURCE_TYPES.indexOf(a.type) - RESOURCE_TYPES.indexOf(b.type)
      const aid = a.data.id
      const bid = b.data.id
      return typeof aid === 'number' && typeof bid === 'number' ? bid - aid : String(bid).localeCompare(String(aid))
    })
    return {
      items: items.slice(offset, offset + limit),
      total: results.reduce((sum, result) => sum + result.total, 0),
      limit, offset,
      tags: tags.map(tag => ({ name: tag.name, count: tag._count._all })),
    }
  }
}
