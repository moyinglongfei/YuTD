import { BadRequestException, NotFoundException } from 'elysia-http-exception'
import { prisma } from '@/lib/prisma'
import { getPhaseWeekCount } from '@/modules/phase/service'
import type { EventScheduleModelType } from '@/modules/eventSchedule/model'

function validateTimeRange(startTime: string, endTime: string) {
  if (startTime >= endTime)
    throw new BadRequestException('结束时间必须晚于开始时间')
}

function validateWeeks(weeks: number[], maxWeek: number) {
  if (!weeks.length)
    throw new BadRequestException('请至少选择一个存在周数')
  if (weeks.some(week => !Number.isInteger(week) || week < 1))
    throw new BadRequestException('存在周数必须是大于等于 1 的整数')
  if (weeks.some(week => week > maxWeek))
    throw new BadRequestException(`存在周数不能超过所属阶段的 ${maxWeek} 周`)
  if (new Set(weeks).size !== weeks.length)
    throw new BadRequestException('存在周数不能重复')
}

export abstract class EventScheduleService {
  static getAll(phaseId?: number) {
    return prisma.eventSchedule.findMany({
      where: phaseId ? { event: { phaseId } } : undefined,
      include: { event: { include: { phase: true } } },
      orderBy: [
        { weekday: 'asc' },
        { startTime: 'asc' },
      ],
    })
  }

  static async create(data: EventScheduleModelType['create']) {
    validateTimeRange(data.startTime, data.endTime)

    const event = await prisma.event.findUnique({
      where: { id: data.eventId },
      include: { phase: true },
    })
    if (!event)
      throw new NotFoundException('事件不存在')
    if (!event.phase)
      throw new BadRequestException('事件尚未归属阶段')

    const maxWeek = getPhaseWeekCount(event.phase.startDate, event.phase.endDate)
    validateWeeks(data.weeks, maxWeek)
    const weeks = [...data.weeks].sort((a, b) => a - b)

    return prisma.eventSchedule.create({
      data: {
        ...data,
        weeks,
      },
      include: { event: { include: { phase: true } } },
    })
  }

  static async update(id: number, data: Partial<EventScheduleModelType['create']>) {
    const schedule = await prisma.eventSchedule.findUnique({ where: { id } })
    if (!schedule)
      throw new NotFoundException('事件排期不存在')

    const eventId = data.eventId ?? schedule.eventId
    const startTime = data.startTime ?? schedule.startTime
    const endTime = data.endTime ?? schedule.endTime
    const weeks = data.weeks ?? (schedule.weeks as number[])
    validateTimeRange(startTime, endTime)

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { phase: true },
    })
    if (!event)
      throw new NotFoundException('事件不存在')
    if (!event.phase)
      throw new BadRequestException('事件尚未归属阶段')

    const maxWeek = getPhaseWeekCount(event.phase.startDate, event.phase.endDate)
    validateWeeks(weeks, maxWeek)
    const sortedWeeks = [...weeks].sort((a, b) => a - b)

    return prisma.eventSchedule.update({
      where: { id },
      data: {
        ...data,
        weeks: sortedWeeks,
      },
      include: { event: { include: { phase: true } } },
    })
  }

  static async delete(id: number) {
    const schedule = await prisma.eventSchedule.findUnique({ where: { id } })
    if (!schedule)
      throw new NotFoundException('事件排期不存在')
    return prisma.eventSchedule.delete({ where: { id } })
  }
}
