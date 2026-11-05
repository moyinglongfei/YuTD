import type { UnwrapSchema } from 'elysia'
import { t } from 'elysia'

const color = t.String({ pattern: '^#[0-9a-fA-F]{6}$' })
const fields = {
  name: t.String({ minLength: 1, maxLength: 80 }),
  showMode: t.Optional(t.Union([t.Literal(0), t.Literal(1)])),
  backgroundPrimary: color,
  backgroundSecondary: color,
  textPrimary: color,
  textSecondary: color,
  fontFamily: t.String({ minLength: 1, maxLength: 200 }),
}
export const StyleModel = {
  create: t.Object(fields),
  update: t.Partial(t.Object(fields)),
} as const
export type StyleModelType = {
  [k in keyof typeof StyleModel]: UnwrapSchema<typeof StyleModel[k]>
}
