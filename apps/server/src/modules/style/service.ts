import type { StyleModelType } from './model'
import { prisma } from '#backend/lib/prisma'

function toStyle(record: Awaited<ReturnType<typeof prisma.style.findFirstOrThrow>>): StyleModelType['style'] {
  return {
    name: record.name,
    defaultLocale: record.defaultLocale,
  }
}

export abstract class StyleService {
  static async ensureStyle() {
    let style = await prisma.style.findFirst()
    if (!style) {
      style = await prisma.style.create({
        data: {
          name: '我的样式',
          defaultLocale: 'zh-CN',
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
        name: data.name?.trim(),
        defaultLocale: data.defaultLocale,
      },
    })
    return toStyle(updated)
  }
}
