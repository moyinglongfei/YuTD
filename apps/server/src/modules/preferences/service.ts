import { NotFoundException } from 'elysia-http-exception'
import { prisma } from '#backend/lib/prisma'
import type { PreferencesModelType } from './model'

const preferencesInclude = {
  defaultPhase: true,
  activeStyle: true,
}

export abstract class PreferencesService {
  static ensurePreferences() {
    return prisma.preferences.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {},
      include: preferencesInclude,
    })
  }

  static get() {
    return this.ensurePreferences()
  }

  static async replace(data: PreferencesModelType['replace']) {
    await this.ensurePreferences()
    await this.validateReferences(data.defaultPhaseId, data.activeStyleId)

    return prisma.preferences.update({
      where: { id: 1 },
      data,
      include: preferencesInclude,
    })
  }

  static async update(data: PreferencesModelType['update']) {
    const current = await this.ensurePreferences()
    return this.replace({
      defaultPhaseId: data.defaultPhaseId === undefined
        ? current.defaultPhaseId
        : data.defaultPhaseId,
      activeStyleId: data.activeStyleId === undefined
        ? current.activeStyleId
        : data.activeStyleId,
    })
  }

  static reset() {
    return this.replace({
      defaultPhaseId: null,
      activeStyleId: null,
    })
  }

  private static async validateReferences(defaultPhaseId: number | null, activeStyleId: number | null) {
    if (defaultPhaseId !== null) {
      const phase = await prisma.phase.findUnique({ where: { id: defaultPhaseId } })
      if (!phase)
        throw new NotFoundException('默认阶段不存在')
    }

    if (activeStyleId !== null) {
      const style = await prisma.style.findUnique({ where: { id: activeStyleId } })
      if (!style)
        throw new NotFoundException('启用样式不存在')
    }
  }
}
