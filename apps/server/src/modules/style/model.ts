import type { UnwrapSchema } from 'elysia'
import { t } from 'elysia'

export const StyleModel = {
  style: t.Object({
    defaultLocale: t.String(),
    scheduleBackground: t.String(),
    schedulePanelBackground: t.String(),
    scheduleGridLineColor: t.String(),
    scheduleSlotHeight: t.Number(),
    scheduleSlotGap: t.Number(),
    presetName: t.String(),
    coursePalette: t.Array(t.String()),
    schedulePageClass: t.String(),
    scheduleBoardClass: t.String(),
    scheduleCardClass: t.String(),
    customCss: t.String(),
  }),

  update: t.Partial(t.Object({
    defaultLocale: t.String(),
    scheduleBackground: t.String(),
    schedulePanelBackground: t.String(),
    scheduleGridLineColor: t.String(),
    scheduleSlotHeight: t.Number(),
    scheduleSlotGap: t.Number(),
    presetName: t.String(),
    coursePalette: t.Array(t.String()),
    schedulePageClass: t.String(),
    scheduleBoardClass: t.String(),
    scheduleCardClass: t.String(),
    customCss: t.String(),
  })),
} as const

export type StyleModelType = {
  [k in keyof typeof StyleModel]: UnwrapSchema<typeof StyleModel[k]>
}
