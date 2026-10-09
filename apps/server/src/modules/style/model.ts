import type { UnwrapSchema } from 'elysia'
import { t } from 'elysia'

export const StyleModel = {
  style: t.Object({
    name: t.String(),
    defaultLocale: t.String(),
  }),

  update: t.Partial(t.Object({
    name: t.String({ minLength: 1 }),
    defaultLocale: t.String({ minLength: 1 }),
  })),
} as const

export type StyleModelType = {
  [k in keyof typeof StyleModel]: UnwrapSchema<typeof StyleModel[k]>
}
