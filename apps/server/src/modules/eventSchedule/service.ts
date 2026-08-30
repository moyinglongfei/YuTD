import type { Prisma } from '@/../../generated/prisma/client'
import { BadRequestException, NotFoundException } from 'elysia-http-exception'
import { prisma } from '@/lib/prisma'
import { getPhaseWeekCount } from '@/modules/phase/service'

function validateTimeRange(startTime: string, endTime: string) {
  if (startTime >= endTime)
    throw new BadRequestException('结束时间必须晚于开始时间')
}

export abstract class EventScheduleService {
  static getAll(phaseId?: number) {
    return prisma.eventSchedule.findMany({
      where: phaseId ? { event: { phaseId } } : undefined,
      include: { event: { include: { phase: true } } },
      orderBy: [
        { weekday: 'asc' },
        { startTime: 'asc' },
        { startWeek: 'asc' },
      ],
    })
  }

  static async create(data: Prisma.EventScheduleUncheckedCreateInput) {
    validateTimeRange(data.startTime, data.endTime)
    if (data.startWeek > data.endWeek)
      throw new BadRequestException('结束周不能早于开始周')

    const event = await prisma.event.findUnique({
      where: { id: data.eventId },
      include: { phase: true },
    })
    if (!event)
      throw new NotFoundException('事件不存在')
    if (!event.phase)
      throw new BadRequestException('事件尚未归属阶段')

    const maxWeek = getPhaseWeekCount(event.phase.startDate, event.phase.endDate)
    if (data.endWeek > maxWeek)
      throw new BadRequestException(`结束周不能超过所属阶段的 ${maxWeek} 周`)

    return prisma.eventSchedule.create({
      data,
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
