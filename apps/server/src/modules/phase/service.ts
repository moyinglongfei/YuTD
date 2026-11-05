import { BadRequestException, NotFoundException } from 'elysia-http-exception'
import { prisma } from '#backend/lib/prisma'

const DAY_IN_MS = 24 * 60 * 60 * 1000

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()))
    throw new BadRequestException('日期格式无效')
  return date
}

export function getPhaseWeekCount(startDate: Date, endDate: Date) {
  return Math.floor((endDate.getTime() - startDate.getTime()) / DAY_IN_MS / 7) + 1
}

export function getPhaseWeekNumber(date: string, startDate: Date, endDate: Date) {
  const selected = parseDate(date)
  if (selected < startDate || selected > endDate) return null
  return Math.floor((selected.getTime() - startDate.getTime()) / DAY_IN_MS / 7) + 1
}

function validateRange(startDate: Date, endDate: Date) {
  if (startDate.getUTCDay() !== 1)
    throw new BadRequestException('阶段开始日期必须是周一')
  if (endDate.getUTCDay() !== 0)
    throw new BadRequestException('阶段结束日期必须是周日')
  if (endDate < startDate)
    throw new BadRequestException('阶段结束日期不能早于开始日期')

  const inclusiveDays = Math.floor((endDate.getTime() - startDate.getTime()) / DAY_IN_MS) + 1
  if (inclusiveDays % 7 !== 0)
    throw new BadRequestException('阶段必须包含完整的自然周')
}

function withWeekCount<T extends { startDate: Date, endDate: Date }>(phase: T) {
  return {
    ...phase,
    weekCount: getPhaseWeekCount(phase.startDate, phase.endDate),
  }
}

export abstract class PhaseService {
  static async getAll() {
    const phases = await prisma.phase.findMany({
      include: {
        _count: { select: { events: true, tasks: true } },
      },
      orderBy: { startDate: 'asc' },
    })
    return phases.map(withWeekCount)
  }

  static async getById(id: number) {
    const phase = await prisma.phase.findUnique({
      where: { id },
      include: {
        _count: { select: { events: true, tasks: true } },
      },
    })
    if (!phase)
      throw new NotFoundException('阶段不存在')
    return withWeekCount(phase)
  }

  static async create(data: { name: string, startDate: string, endDate: string }) {
    const startDate = parseDate(data.startDate)
    const endDate = parseDate(data.endDate)
    validateRange(startDate, endDate)

    const phase = await prisma.phase.create({
      data: {
        name: data.name.trim(),
        startDate,
        endDate,
      },
    })
    return withWeekCount(phase)
  }

  static async update(id: number, data: { name?: string, startDate?: string, endDate?: string }) {
    const current = await prisma.phase.findUnique({ where: { id } })
    if (!current)
      throw new NotFoundException('阶段不存在')

    const startDate = data.startDate ? parseDate(data.startDate) : current.startDate
    const endDate = data.endDate ? parseDate(data.endDate) : current.endDate
    validateRange(startDate, endDate)

    const phase = await prisma.$transaction(async (tx) => {
      const updated = await tx.phase.update({ where: { id }, data: { name: data.name?.trim(), startDate, endDate } })
      if (startDate.getTime() !== current.startDate.getTime() || endDate.getTime() !== current.endDate.getTime()) {
        await tx.week.updateMany({ where: { phaseId: id }, data: { weekNumber: null } })
        const weeks = await tx.week.findMany({ where: { phaseId: id }, select: { id: true, date: true } })
        for (const week of weeks) {
          await tx.week.update({ where: { id: week.id }, data: { weekNumber: getPhaseWeekNumber(week.date, startDate, endDate) } })
        }
      }
      return updated
    })
    return withWeekCount(phase)
  }

  static async delete(id: number) {
    const phase = await prisma.phase.findUnique({ where: { id } })
    if (!phase)
      throw new NotFoundException('阶段不存在')
    return prisma.phase.delete({ where: { id } })
  }
}
