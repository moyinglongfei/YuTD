import type { Prisma } from '#prisma/client'
import type { TaskModelType } from '#backend/modules/task/model'
import { BadRequestException, NotFoundException } from 'elysia-http-exception'
import { prisma } from '#backend/lib/prisma'

async function validateRelations(phaseId?: number, eventId?: number) {
  if (!phaseId)
    throw new BadRequestException('请选择任务所属阶段')

  const phase = await prisma.phase.findUnique({ where: { id: phaseId } })
  if (!phase)
    throw new BadRequestException('所属阶段不存在')

  if (eventId) {
    const event = await prisma.event.findUnique({ where: { id: eventId } })
    if (!event)
      throw new BadRequestException('关联事件不存在')
    if (event.phaseId !== phaseId)
      throw new BadRequestException('关联事件与任务不属于同一阶段')
  }
}

function parseDateTime(value: string, field: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime()))
    throw new BadRequestException(`${field}格式无效`)
  return date
}

function normalizeReminderTimes(values: string[]) {
  return [...new Set(values.map(value => parseDateTime(value, '提醒时间').toISOString()))]
    .map(time => ({ time: new Date(time) }))
}

function normalizeTags(values: string[]) {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))]
    .map(name => ({ name }))
}

function toPrismaData(data: TaskModelType['update'], replaceCollections = false) {
  const { isDone, dueDate, reminderTimes, tags, ...rest } = data
  return {
    ...rest,
    dueDate: dueDate ? parseDateTime(dueDate, '截止时间') : undefined,
    completed: isDone,
    reminders: reminderTimes
      ? {
          ...(replaceCollections ? { deleteMany: {} } : {}),
          create: normalizeReminderTimes(reminderTimes),
        }
      : undefined,
    tags: tags
      ? {
          ...(replaceCollections ? { deleteMany: {} } : {}),
          create: normalizeTags(tags),
        }
      : undefined,
  }
}

const taskInclude = {
  phase: true,
  event: true,
  reminders: { orderBy: { time: 'asc' as const } },
  tags: { orderBy: { name: 'asc' as const } },
}

export abstract class TaskService {
  static async findMany(filters: TaskModelType['query']) {
    const where: Prisma.TaskWhereInput = {}
    if (filters.status)
      where.status = filters.status
    if (filters.phaseId)
      where.phaseId = filters.phaseId
    if (filters.eventId)
      where.eventId = filters.eventId
    if (filters.tag)
      where.tags = { some: { name: filters.tag } }

    const tasks = await prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: { createdAt: 'desc' },
    })
    return tasks.map(task => ({ ...task, isDone: task.completed }))
  }

  static async create(data: TaskModelType['create'] & { title: string, phaseId: number }) {
    await validateRelations(data.phaseId, data.eventId)
    const task = await prisma.task.create({
      data: toPrismaData(data) as Prisma.TaskUncheckedCreateInput,
      include: taskInclude,
    })
    return { ...task, isDone: task.completed }
  }

  static async update(id: number, data: TaskModelType['update']) {
    const exists = await prisma.task.findUnique({ where: { id } })
    if (!exists)
      throw new NotFoundException('找不到这个任务喵！')

    const phaseId = data.phaseId ?? exists.phaseId ?? undefined
    const eventId = data.eventId ?? exists.eventId ?? undefined
    await validateRelations(phaseId, eventId)

    const task = await prisma.task.update({
      where: { id },
      data: toPrismaData(data, true) as Prisma.TaskUncheckedUpdateInput,
      include: taskInclude,
    })
    return { ...task, isDone: task.completed }
  }
}
