import type { Prisma, Task } from '#prisma/client'
import type { TaskModelType } from '#backend/modules/task/model'
import { BadRequestException, NotFoundException } from 'elysia-http-exception'
import { prisma } from '#backend/lib/prisma'
import { calendarDate, parseZonedDateTime, taskDateRange } from '#shared/time'
import { PreferencesService } from '../preferences/service'
import { getPhaseWeekCount, getPhaseWeekNumber } from '../phase/service'

async function validateRelations(phaseId?: number, eventId?: number, database: Pick<Prisma.TransactionClient, 'phase' | 'event'> = prisma) {
  if (!phaseId)
    throw new BadRequestException('请选择任务所属阶段')

  const phase = await database.phase.findUnique({ where: { id: phaseId } })
  if (!phase)
    throw new BadRequestException('所属阶段不存在')

  if (eventId) {
    const event = await database.event.findUnique({ where: { id: eventId } })
    if (!event)
      throw new BadRequestException('关联事件不存在')
    if (event.phaseId !== phaseId)
      throw new BadRequestException('关联事件与任务不属于同一阶段')
  }
}

function parseDateTime(value: string, field: string, timeZone: string) {
  try {
    return parseZonedDateTime(value, timeZone)
  } catch {
    throw new BadRequestException(`${field}格式无效，或在当前时区不存在／有歧义；可使用带时区偏移的 ISO 时间`)
  }
}

function normalizeReminderTimes(values: string[], timeZone: string) {
  return [...new Set(values.map(value => parseDateTime(value, '提醒时间', timeZone).toISOString()))]
    .map(time => ({ time: new Date(time) }))
}

function normalizeTags(values: string[]) {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))]
    .map(name => ({ name }))
}

async function toPrismaData(data: TaskModelType['update'], replaceCollections = false, current?: Task, zone?: string) {
  const { isDone, dueDate, plannedDate, reminderTimes, tags, ...rest } = data
  const timeZone = zone ?? await PreferencesService.getTimeZone()
  if (rest.title !== undefined) {
    rest.title = rest.title.trim()
    if (!rest.title) throw new BadRequestException('请输入任务名称')
  }
  if (rest.priority !== undefined && (!Number.isInteger(rest.priority) || rest.priority < 1 || rest.priority > 5))
    throw new BadRequestException('优先级必须为 1 至 5 的整数')
  if (dueDate === null) throw new BadRequestException('请选择截止时间')
  const due = dueDate === undefined ? current?.dueDate : parseDateTime(dueDate, '截止时间', timeZone)
  const plan = plannedDate === undefined ? current?.plannedDate : plannedDate ? parseDateTime(plannedDate, '计划时间', timeZone) : null
  if ((plannedDate !== undefined || dueDate !== undefined) && plan && (!due || plan >= due))
    throw new BadRequestException('计划时间必须早于截止时间')
  return {
    ...rest,
    dueDate: dueDate === undefined ? undefined : due,
    plannedDate: plannedDate === undefined ? undefined : plan,
    reminders: reminderTimes
      ? {
          ...(replaceCollections ? { deleteMany: {} } : {}),
          create: normalizeReminderTimes(reminderTimes, timeZone),
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

function completionData(data: Pick<TaskModelType['update'], 'status' | 'isDone'>, current?: Pick<Task, 'status' | 'completed' | 'completedAt'>) {
  if (data.status !== undefined && data.isDone !== undefined && data.isDone !== (data.status === 'DONE'))
    throw new BadRequestException('完成状态与任务状态不一致')
  const previous = current?.status === 'CANCELLED' ? 'CANCELLED' : current?.completed ? 'DONE' : current?.status ?? 'TODO'
  const status = data.status ?? (data.isDone === undefined ? previous : data.isDone ? 'DONE' : previous === 'DOING' ? 'DOING' : 'TODO')
  const closed = status === 'DONE' || status === 'CANCELLED'
  return {
    status,
    completed: status === 'DONE',
    completedAt: closed ? previous === status && current?.completedAt ? current.completedAt : new Date() : null,
  }
}

export const taskInclude = {
  phase: true,
  event: true,
  reminders: { orderBy: { time: 'asc' as const } },
  tags: { orderBy: { name: 'asc' as const } },
  tips: true,
}


export abstract class TaskService {
  private static async attention(
    filters: TaskModelType['dailyAttention'] | TaskModelType['weeklyAttention'],
    weekly: boolean,
    requestedState?: 0 | 1
  ) {
    const timeZone = await PreferencesService.getTimeZone()

    return prisma.$transaction(async (tx) => {
      const phase = filters.phase === undefined
        ? null
        : await tx.phase.findUnique({
            where: { id: filters.phase },
            select: { startDate: true, endDate: true },
          })

      if (filters.phase !== undefined && !phase)
        throw new NotFoundException('阶段不存在')

      let date: string
      let requestedWeek: number | null = null

      if (weekly) {
        if (!('weekNumber' in filters) || !phase)
          throw new BadRequestException('周查询需要指定阶段和周数')

        const weekNumber = filters.weekNumber
        const weekCount = getPhaseWeekCount(phase.startDate, phase.endDate)

        if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > weekCount)
          throw new BadRequestException('选择的周超出了阶段范围')

        // 按阶段开始日期计算第 N 周的起始日期
        const start = new Date(phase.startDate)
        start.setUTCDate(start.getUTCDate() + (weekNumber - 1) * 7)

        date = start.toISOString().slice(0, 10)
        requestedWeek = weekNumber
      } else {
        if (!('date' in filters))
          throw new BadRequestException('请选择有效日期')

        try {
          date = calendarDate(
            parseZonedDateTime(filters.date, timeZone),
            timeZone
          )
        } catch {
          throw new BadRequestException('请选择有效日期；带时间且存在时区歧义时请提供明确偏移')
        }
      }

      const range = taskDateRange(date, timeZone, weekly)

      const weekNumber = weekly && phase
        ? getPhaseWeekNumber(range.startDate, phase.startDate, phase.endDate)
        : null

      if (weekly && (weekNumber === null || weekNumber !== requestedWeek))
        throw new BadRequestException('选择的周超出了阶段范围')

      const id = `${filters.phase ?? 'all'}:${range.startDate}`

      const options = {
        where: { id },
        create: {
          id,
          date: range.startDate,
          phaseId: filters.phase ?? null,
        },
        update: {},
      }

      const record = weekly
        ? await tx.week.upsert({
            ...options,
            create: { ...options.create, weekNumber },
            update: { weekNumber },
          })
        : await tx.date.upsert(options)

      const records = await tx.task.findMany({
        where: {
          phaseId: filters.phase,
          OR: [
            { plannedDate: { gte: range.start, lt: range.end } },
            { dueDate: { gte: range.start, lt: range.end } },
            {
              completed: false,
              status: { notIn: ['DONE', 'CANCELLED'] },
              OR: [
                { plannedDate: { lt: range.start } },
                { dueDate: { lt: range.start } },
              ],
            },
          ],
        },
        include: taskInclude,
        orderBy: [{ priority: 'desc' }, { id: 'asc' }],
      })

      const tasks = records.map(task => ({
        ...task,
        isDone: task.completed,
      }))

      const allDone = tasks.every(
        task => task.completed
          || task.status === 'DONE'
          || task.status === 'CANCELLED'
      )

      if (requestedState === 1 && !allDone)
        throw new BadRequestException('还有未处理任务，暂时不能全部清空')

      const cleared = requestedState
        ?? (allDone && record.taskState === 1 ? 1 : 0)

      if (record.taskState !== cleared) {
        const update = {
          where: { id },
          data: { taskState: cleared },
        }

        if (weekly)
          await tx.week.update(update)
        else
          await tx.date.update(update)
      }

      return {
        date,
        timeZone,
        startDate: range.startDate,
        endDate: range.endDate,
        rangeStart: range.start.toISOString(),
        rangeEnd: range.end.toISOString(),
        tasks,
        allDone,
        cleared,
        weekNumber,
        phase: phase
          ? {
              startDate: phase.startDate.toISOString().slice(0, 10),
              endDate: phase.endDate.toISOString().slice(0, 10),
              weekCount: getPhaseWeekCount(phase.startDate, phase.endDate),
            }
          : null,
      }
    })
  }

  static async setAttention(
    filters: TaskModelType['dailyAttention'] | TaskModelType['weeklyAttention'],
    weekly: boolean,
    cleared: 0 | 1
  ) {
    return this.attention(filters, weekly, cleared)
  }

  static async daily(filters: TaskModelType['dailyAttention']) {
    return this.attention(filters, false)
  }

  static async weekly(filters: TaskModelType['weeklyAttention']) {
    return this.attention(filters, true)
  }
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
    if (!data.dueDate) throw new BadRequestException('请选择截止时间')
    await validateRelations(data.phaseId, data.eventId)
    const task = await prisma.task.create({
      data: { ...await toPrismaData(data), ...completionData(data) } as Prisma.TaskUncheckedCreateInput,
      include: taskInclude,
    })
    return { ...task, isDone: task.completed }
  }

  static async update(id: number, data: TaskModelType['update']) {
    const timeZone = await PreferencesService.getTimeZone()
    const task = await prisma.$transaction(async (tx) => {
      const exists = await tx.task.findUnique({ where: { id } })
      if (!exists)
        throw new NotFoundException('找不到这个任务喵！')
      await validateRelations(data.phaseId ?? exists.phaseId, data.eventId === undefined ? exists.eventId ?? undefined : data.eventId ?? undefined, tx)
      const values = await toPrismaData(data, true, exists, timeZone)
      return tx.task.update({
        where: { id },
        data: { ...values, ...completionData(data, exists) } as Prisma.TaskUncheckedUpdateInput,
        include: taskInclude,
      })
    })
    return { ...task, isDone: task.completed }
  }

  static async postpone(id: number, data: TaskModelType['postpone']) {
    const timeZone = await PreferencesService.getTimeZone()
    const plannedDate = parseDateTime(data.plannedDate, '延期时间', timeZone)
    return prisma.$transaction(async (tx) => {
      const current = await tx.task.findUnique({ where: { id } })
      if (!current)
        throw new NotFoundException('找不到这个任务喵！')
      if (current.completed || current.status === 'DONE' || current.status === 'CANCELLED')
        throw new BadRequestException('已完成或已放弃的任务无需延期')
      if (plannedDate.getTime() <= Date.now())
        throw new BadRequestException('延期时间必须晚于当前时间')
      if (current.dueDate && plannedDate >= current.dueDate)
        throw new BadRequestException('延期时间必须早于截止时间')
      const task = await tx.task.update({ where: { id }, data: { plannedDate }, include: taskInclude })
      return { ...task, isDone: task.completed }
    })
  }
}
