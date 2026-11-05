import { BadRequestException, NotFoundException } from 'elysia-http-exception'
import { prisma } from '#backend/lib/prisma'
import { inferTimeZone, normalizeTimeZone } from '#shared/time'
import { bumpDataVersion } from '#backend/lib/version'
import { StyleService } from '../style/service'
import type { PreferencesModelType } from './model'

function toPreferences(record: Awaited<ReturnType<typeof prisma.preferences.findUniqueOrThrow>>) {
  const { defaultLocale, defaultPhaseId, activeStyleId, sidebarWidth, maxFocusScale, focusColumnScale, hourPixels, edgePixels } = record
  return { defaultLocale, defaultPhaseId, activeStyleId, sidebarWidth: Math.min(135, Math.max(64, sidebarWidth)), maxFocusScale, focusColumnScale, hourPixels, edgePixels,
    timeZone: record.timeZone ?? 'UTC', timeZoneAutomatic: record.timeZoneAutomatic }
}
export abstract class PreferencesService {
  static async ensurePreferences() {
    const style = await StyleService.ensureStyle()
    const current = await prisma.preferences.findUnique({ where: { id: 1 } })
      ?? await prisma.preferences.upsert({
        where: { id: 1 }, create: { id: 1, activeStyleId: style.id }, update: {},
      })
    if (current.activeStyleId !== null && current.timeZone !== null)
      return current
    const updated = await prisma.preferences.update({ where: { id: 1 }, data: {
      activeStyleId: current.activeStyleId ?? style.id,
      timeZone: current.timeZone ?? inferTimeZone(current.defaultLocale),
    } })
    await bumpDataVersion()
    return updated
  }
  static async get() {
    return toPreferences(await this.ensurePreferences())
  }
  static async getTimeZone() {
    return (await this.get()).timeZone
  }
  static async replace(data: PreferencesModelType['replace']) {
    await this.ensurePreferences()
    await this.validateReferences(data)
    return toPreferences(await prisma.preferences.update({ where: { id: 1 }, data: this.normalize(data) }))
  }
  static async update(data: PreferencesModelType['update']) {
    await this.ensurePreferences()
    await this.validateReferences(data)
    return toPreferences(await prisma.preferences.update({ where: { id: 1 }, data: this.normalize(data) }))
  }
  static async reset() {
    const style = await StyleService.ensureStyle()
    return this.replace({
      defaultLocale: 'zh-CN',
      defaultPhaseId: null, activeStyleId: style.id, sidebarWidth: 64,
      maxFocusScale: 2, focusColumnScale: 3, hourPixels: 72, edgePixels: 20,
      timeZone: inferTimeZone('zh-CN'), timeZoneAutomatic: true,
    })
  }
  private static normalize(data: PreferencesModelType['update']) {
    const value = { ...data }
    if (value.defaultLocale !== undefined) {
      value.defaultLocale = value.defaultLocale.trim()
      if (!value.defaultLocale)
        throw new BadRequestException('语言不能为空')
    }
    if (value.timeZone !== undefined) {
      try {
        value.timeZone = normalizeTimeZone(value.timeZone.trim())
      } catch {
        throw new BadRequestException('时区必须是有效的 IANA 时区，例如 Asia/Shanghai')
      }
    }
    return value
  }
  private static async validateReferences(data: PreferencesModelType['update']) {
    if (data.defaultPhaseId != null && !await prisma.phase.findUnique({ where: { id: data.defaultPhaseId } }))
      throw new NotFoundException('默认阶段不存在')
    if (data.activeStyleId != null && !await prisma.style.findUnique({ where: { id: data.activeStyleId } }))
      throw new NotFoundException('启用样式不存在')
  }
}
