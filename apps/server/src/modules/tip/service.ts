import type { Prisma } from '#prisma/client'
import { BadRequestException, NotFoundException } from 'elysia-http-exception'
import { prisma } from '#backend/lib/prisma'
import { addCalendarDays, calendarDate, calendarDayNumber, calendarWeekday, parseZonedDateTime, taskDateRange } from '#shared/time'
import { PreferencesService } from '../preferences/service'
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

function calendarRelations(values: string[] | undefined, ids: string[] | undefined, weekly: boolean, replace: boolean) {
  if (values === undefined && ids === undefined) return undefined
  const references = [...new Set(ids ?? [])].map(id => ({ id }))
  const dates = [...new Set((values ?? []).map(validateDate).map(date => weekly ? taskDateRange(date, 'UTC', true).startDate : date))]
  return {
    ...(replace ? { set: references } : { connect: references }),
    connectOrCreate: dates.map(date => ({ where: { id: `all:${date}` }, create: { id: `all:${date}`, date } }))
  }
}

function toPrismaData(data: TipModelType['update'], replaceCollections = false) {
  if (data.content !== undefined && !data.content.trim())
    throw new BadRequestException('提示内容不能为空')

  return {
    content: data.content,
    dates: calendarRelations(data.dates, data.dateIds, false, replaceCollections),
    weeks: calendarRelations(data.weeks, data.weekIds, true, replaceCollections),
    events: toRelations(data.eventIds, replaceCollections),
    phases: toRelations(data.phaseIds, replaceCollections),
    tasks: toRelations(data.taskIds, replaceCollections),
  }
}

async function validateRelations(tx: Prisma.TransactionClient, data: TipModelType['update']) {
  const [events, phases, tasks, dates, weeks] = await Promise.all([
    data.eventIds?.length
      ? tx.event.findMany({ where: { id: { in: data.eventIds } }, select: { id: true } })
      : [],
    data.phaseIds?.length
      ? tx.phase.findMany({ where: { id: { in: data.phaseIds } }, select: { id: true } })
      : [],
    data.taskIds?.length
      ? tx.task.findMany({ where: { id: { in: data.taskIds } }, select: { id: true } })
      : [],
    data.dateIds?.length ? tx.date.findMany({ where: { id: { in: data.dateIds } }, select: { id: true } }) : [],
    data.weekIds?.length ? tx.week.findMany({ where: { id: { in: data.weekIds } }, select: { id: true } }) : [],
  ])

  if (events.length !== new Set(data.eventIds).size)
    throw new BadRequestException('关联事件不存在')
  if (phases.length !== new Set(data.phaseIds).size)
    throw new BadRequestException('关联阶段不存在')
  if (tasks.length !== new Set(data.taskIds).size)
    throw new BadRequestException('关联任务不存在')
  if (dates.length !== new Set(data.dateIds).size)
    throw new BadRequestException('关联日期不存在')
  if (weeks.length !== new Set(data.weekIds).size)
    throw new BadRequestException('关联周不存在')
}

const tipInclude = {
  dates: { orderBy: { date: 'asc' as const } },
  weeks: { orderBy: { date: 'asc' as const } },
  events: { orderBy: { id: 'asc' as const } },
  phases: { orderBy: { id: 'asc' as const } },
  tasks: { orderBy: { id: 'asc' as const } },
}

export abstract class TipService {
  static async daily(filters: TipModelType['daily']) {
    const timeZone = await PreferencesService.getTimeZone()
    const day = validateDate(filters.date)
    let range: ReturnType<typeof taskDateRange>
    try {
      range = taskDateRange(day, timeZone, false)
    } catch {
      throw new BadRequestException('该日期在当前时区不存在')
    }
    const [schedules, tasks] = await Promise.all([
      prisma.eventSchedule.findMany({
        where: {
          weekday: calendarWeekday(day),
          event: { phaseId: filters.phase, phase: {
            startDate: { lte: new Date(`${day}T00:00:00Z`) },
            endDate: { gte: new Date(`${day}T00:00:00Z`) },
          } },
        },
        include: { event: { include: { phase: true } } },
      }),
      prisma.task.findMany({
        where: {
          phaseId: filters.phase,
          OR: [
            { plannedDate: { gte: range.start, lt: range.end } },
            { dueDate: { gte: range.start, lt: range.end } },
          ],
        },
        select: { id: true, title: true, phaseId: true, priority: true, plannedDate: true, dueDate: true, completed: true, status: true },
      }),
    ])

    const occurrences: { eventId: number, scheduleId: number, phaseId: number, time: string, endTime: string }[] = []
    for (const schedule of schedules) {
      const firstDay = schedule.event.phase.startDate.toISOString().slice(0, 10)
      const week = Math.floor((calendarDayNumber(day) - calendarDayNumber(firstDay)) / 7) + 1
      if (!Array.isArray(schedule.weeks) || !schedule.weeks.includes(week)) continue
      const start = parseZonedDateTime(`${day}T${schedule.startTime}`, timeZone, 'compatible')
      const endDay = schedule.endTime <= schedule.startTime ? addCalendarDays(day, 1) : day
      const end = parseZonedDateTime(`${endDay}T${schedule.endTime}`, timeZone, 'compatible')
      if (calendarDate(start, timeZone) !== day) continue
      occurrences.push({
        eventId: schedule.eventId, scheduleId: schedule.id, phaseId: schedule.event.phaseId,
        time: start.toISOString(), endTime: end.toISOString(),
      })
    }

    const eventIds = new Set(occurrences.map(value => value.eventId))
    const tips = await prisma.tip.findMany({
      where: { OR: [
        { dates: { some: { date: day, ...(filters.phase === undefined ? {} : { OR: [{ phaseId: null }, { phaseId: filters.phase }] }) } } },
        { weeks: { some: { date: taskDateRange(day, timeZone, true).startDate, ...(filters.phase === undefined ? {} : { OR: [{ phaseId: null }, { phaseId: filters.phase }] }) } } },
        { events: { some: { id: { in: [...eventIds] } } } },
        { tasks: { some: { id: { in: tasks.map(task => task.id) } } } },
      ] },
      include: tipInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return { date: day, timeZone, tips, tasks, occurrences }
  }

  static findMany(filters: TipModelType['query']) {
    const where: Prisma.TipWhereInput = {}
    if (filters.date)
      where.dates = { some: { date: validateDate(filters.date) } }
    if (filters.week)
      where.weeks = { some: { date: taskDateRange(validateDate(filters.week), 'UTC', true).startDate } }
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
