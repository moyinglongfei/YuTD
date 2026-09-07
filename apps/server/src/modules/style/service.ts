import type { StyleModelType } from './model'
import { prisma } from '#backend/lib/prisma'

function parsePalette(value: string) {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  }
  catch {
    return []
  }
}

function toStyle(record: Awaited<ReturnType<typeof prisma.style.findFirstOrThrow>>): StyleModelType['style'] {
  return {
    defaultLocale: record.defaultLocale,
    scheduleBackground: record.scheduleBackground,
    schedulePanelBackground: record.schedulePanelBackground,
    scheduleGridLineColor: record.scheduleGridLineColor,
    scheduleSlotHeight: record.scheduleSlotHeight,
    scheduleSlotGap: record.scheduleSlotGap,
    presetName: record.presetName,
    coursePalette: parsePalette(record.coursePalette),
    schedulePageClass: record.schedulePageClass,
    scheduleBoardClass: record.scheduleBoardClass,
    scheduleCardClass: record.scheduleCardClass,
    customCss: record.customCss,
  }
}

export abstract class StyleService {
  static async ensureStyle() {
    let style = await prisma.style.findFirst()
    if (!style) {
      style = await prisma.style.create({
        data: {
          defaultLocale: 'zh-CN',
          scheduleBackground: '#f4efe7',
          schedulePanelBackground: 'rgba(255,255,255,0.82)',
          scheduleGridLineColor: 'rgba(226,232,240,0.9)',
          scheduleSlotHeight: 72,
          scheduleSlotGap: 8,
          presetName: 'campus',
          coursePalette: JSON.stringify(['#0f766e', '#1d4ed8', '#be123c', '#7c3aed']),
          schedulePageClass: '',
          scheduleBoardClass: '',
          scheduleCardClass: '',
          customCss: '',
        },
      })
    }
    return style
  }

  static async get() {
    const style = await this.ensureStyle()
    return toStyle(style)
  }

  static async update(data: StyleModelType['update']) {
    const current = await this.ensureStyle()
    const updated = await prisma.style.update({
      where: { id: current.id },
      data: {
        defaultLocale: data.defaultLocale ?? current.defaultLocale,
        scheduleBackground: data.scheduleBackground ?? current.scheduleBackground,
        schedulePanelBackground: data.schedulePanelBackground ?? current.schedulePanelBackground,
        scheduleGridLineColor: data.scheduleGridLineColor ?? current.scheduleGridLineColor,
        scheduleSlotHeight: data.scheduleSlotHeight ?? current.scheduleSlotHeight,
        scheduleSlotGap: data.scheduleSlotGap ?? current.scheduleSlotGap,
        presetName: data.presetName ?? current.presetName,
        coursePalette: JSON.stringify(data.coursePalette ?? parsePalette(current.coursePalette)),
        schedulePageClass: data.schedulePageClass ?? current.schedulePageClass,
        scheduleBoardClass: data.scheduleBoardClass ?? current.scheduleBoardClass,
        scheduleCardClass: data.scheduleCardClass ?? current.scheduleCardClass,
        customCss: data.customCss ?? current.customCss,
      },
    })
    return toStyle(updated)
  }
}
