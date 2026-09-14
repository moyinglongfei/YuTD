import type { Prisma } from '#prisma/client'
import { BadRequestException, NotFoundException } from 'elysia-http-exception'
import { prisma } from '#backend/lib/prisma'
import { getPhaseWeekCount } from '#backend/modules/phase/service'
import { validateTimeRange, validateWeeks } from '#backend/modules/eventSchedule/service'
import type { EventModelType } from './model'

async function ensurePhase(phaseId: number) {
  const phase = await prisma.phase.findUnique({ where: { id: phaseId } })
  if (!phase)
    throw new BadRequestException('所属阶段不存在')
  return phase
}

export abstract class EventService {
  static getAll(phaseId?: number) {
    return prisma.event.findMany({
      where: phaseId ? { phaseId } : undefined,
      include: {
        phase: true,
        schedules: true,
        _count: { select: { tasks: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  static async create(data: EventModelType['create']) {
    if (data.phaseId === null || data.phaseId === undefined)
      throw new BadRequestException('请选择事件所属阶段')
    const phase = await ensurePhase(data.phaseId)
    const { schedules, ...event } = data
    const maxWeek = getPhaseWeekCount(phase.startDate, phase.endDate)
    const scheduleData = schedules?.map((schedule) => {
      validateTimeRange(schedule.startTime, schedule.endTime)
      validateWeeks(schedule.weeks, maxWeek)
      return {
        ...schedule,
        weeks: [...schedule.weeks].sort((a, b) => a - b),
      }
    })

    return prisma.event.create({
      data: {
        ...event,
        schedules: scheduleData?.length ? { create: scheduleData } : undefined,
      },
      include: { phase: true, schedules: true },
    })
  }

  static async update(id: number, data: Prisma.EventUncheckedUpdateInput) {
    const event = await prisma.event.findUnique({ where: { id } })
    if (!event)
      throw new NotFoundException('事件不存在')
    if (typeof data.phaseId === 'number')
      await ensurePhase(data.phaseId)
    return prisma.event.update({ where: { id }, data, include: { phase: true, schedules: true } })
  }

  static async delete(id: number) {
    const event = await prisma.event.findUnique({ where: { id } })
    if (!event)
      throw new NotFoundException('事件不存在')
    return prisma.event.delete({ where: { id } })
  }
}
