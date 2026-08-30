import type { Prisma } from '@/../../generated/prisma/client'
import { BadRequestException, NotFoundException } from 'elysia-http-exception'
import { prisma } from '@/lib/prisma'

async function ensurePhase(phaseId: number) {
  const phase = await prisma.phase.findUnique({ where: { id: phaseId } })
  if (!phase)
    throw new BadRequestException('所属阶段不存在')
}

export abstract class EventService {
  static getAll(phaseId?: number) {
    return prisma.event.findMany({
      where: phaseId ? { phaseId } : undefined,
      include: {
        phase: true,
        schedules: true,
        _count: { select: { todos: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  static async create(data: Prisma.EventUncheckedCreateInput) {
    if (data.phaseId === null || data.phaseId === undefined)
      throw new BadRequestException('请选择事件所属阶段')
    await ensurePhase(data.phaseId)
    return prisma.event.create({ data, include: { phase: true, schedules: true } })
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
