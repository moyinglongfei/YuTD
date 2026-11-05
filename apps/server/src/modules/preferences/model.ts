import { t } from 'elysia'
import type { UnwrapSchema } from 'elysia'

const nullableId = t.Union([t.Integer({ minimum: 1 }), t.Null()])
const fields = {
  defaultLocale: t.String({ minLength: 1, maxLength: 40 }),
  defaultPhaseId: nullableId,
  activeStyleId: nullableId,
  sidebarWidth: t.Integer({ minimum: 64, maximum: 135 }),
  maxFocusScale: t.Number({ minimum: 0, maximum: 5 }),
  focusColumnScale: t.Number({ minimum: 1, maximum: 6 }),
  hourPixels: t.Integer({ minimum: 24, maximum: 200 }),
  edgePixels: t.Integer({ minimum: 0, maximum: 100 }),
  timeZone: t.String({ minLength: 1, maxLength: 100 }),
  timeZoneAutomatic: t.Boolean(),
}
export const PreferencesModel = {
  replace: t.Object(fields),
  update: t.Partial(t.Object(fields)),
} as const
export type PreferencesModelType = {
  [k in keyof typeof PreferencesModel]: UnwrapSchema<typeof PreferencesModel[k]>
}
