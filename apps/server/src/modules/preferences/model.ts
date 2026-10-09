import { t } from 'elysia'
import type { UnwrapSchema } from 'elysia'

const nullableId = t.Union([t.Number({ minimum: 1 }), t.Null()])

export const PreferencesModel = {
  replace: t.Object({
    defaultPhaseId: nullableId,
    activeStyleId: nullableId,
  }),

  update: t.Partial(t.Object({
    defaultPhaseId: nullableId,
    activeStyleId: nullableId,
  })),
} as const

export type PreferencesModelType = {
  [k in keyof typeof PreferencesModel]: UnwrapSchema<typeof PreferencesModel[k]>
}
