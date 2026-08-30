import type { Prisma } from '@/../../generated/prisma/client'
import type { TodoStatus } from '@/../../generated/prisma/enums'
import { BadRequestException, NotFoundException } from 'elysia-http-exception'
import { prisma } from '@/lib/prisma'

interface TaskFilters {
  status?: TodoStatus
  phaseId?: number
  eventId?: number
  tag?: string
}

interface TaskInput {
  title?: string
  description?: string
  priority?: number
  dueDate?: string
  phaseId?: number
  eventId?: number
  status?: TodoStatus
  isDone?: boolean
}

async function validateRelations(phaseId?: number, eventId?: number) {
  if (!phaseId)
    throw new BadRequestException('请选择待办所属阶段')

  const phase = await prisma.phase.findUnique({ where: { id: phaseId } })
  if (!phase)
    throw new BadRequestException('所属阶段不存在')

  if (eventId) {
    const event = await prisma.event.findUnique({ where: { id: eventId } })
    if (!event)
      throw new BadRequestException('关联事件不存在')
    if (event.phaseId !== phaseId)
      throw new BadRequestException('关联事件与待办不属于同一阶段')
  }
}

function toPrismaData(data: TaskInput): Prisma.TodoUncheckedCreateInput | Prisma.TodoUncheckedUpdateInput {
  const { isDone, dueDate, ...rest } = data
  return {
    ...rest,
    dueDate: dueDate ? new Date(dueDate) : undefined,
    completed: isDone,
  }
}

export abstract class TaskService {
  static async findMany(filters: TaskFilters) {
    const where: Prisma.TodoWhereInput = {}
    if (filters.status)
      where.status = filters.status as TodoStatus
    if (filters.phaseId)
      where.phaseId = filters.phaseId
    if (filters.eventId)
      where.eventId = filters.eventId
    if (filters.tag)
      where.tags = { contains: filters.tag }

    const todos = await prisma.todo.findMany({
      where,
      include: { phase: true, event: true },
      orderBy: { createdAt: 'desc' },
    })
    return todos.map(todo => ({ ...todo, isDone: todo.completed }))
  }

  static async create(data: TaskInput & { title: string, phaseId: number }) {
    await validateRelations(data.phaseId, data.eventId)
    const todo = await prisma.todo.create({
      data: toPrismaData(data) as Prisma.TodoUncheckedCreateInput,
      include: { phase: true, event: true },
    })
    return { ...todo, isDone: todo.completed }
  }

  static async update(id: number, data: TaskInput) {
    const exists = await prisma.todo.findUnique({ where: { id } })
    if (!exists)
      throw new NotFoundException('找不到这个任务喵！')

    const phaseId = data.phaseId ?? exists.phaseId ?? undefined
    const eventId = data.eventId ?? exists.eventId ?? undefined
    await validateRelations(phaseId, eventId)

    const todo = await prisma.todo.update({
      where: { id },
      data: toPrismaData(data) as Prisma.TodoUncheckedUpdateInput,
      include: { phase: true, event: true },
    })
    return { ...todo, isDone: todo.completed }
  }
}
