import type { UnwrapSchema } from 'elysia'
import { t } from 'elysia'

const dateSchema = t.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' })
const idSchema = t.Integer({ minimum: 1 })
const queryIdSchema = t.Numeric({ minimum: 1, multipleOf: 1 })

const tipSchema = t.Object({
  content: t.String({ minLength: 1 }),
  dates: t.Optional(t.Array(dateSchema)),
  weeks: t.Optional(t.Array(dateSchema)),
  dateIds: t.Optional(t.Array(t.String({ minLength: 1 }))),
  weekIds: t.Optional(t.Array(t.String({ minLength: 1 }))),
  eventIds: t.Optional(t.Array(idSchema)),
  phaseIds: t.Optional(t.Array(idSchema)),
  taskIds: t.Optional(t.Array(idSchema)),
})

export const TipModel = {
  daily: t.Object({
    phase: t.Optional(queryIdSchema),
    date: dateSchema,
  }),
  create: tipSchema,
  update: t.Partial(tipSchema),
  query: t.Object({
    date: t.Optional(dateSchema),
    week: t.Optional(dateSchema),
    eventId: t.Optional(queryIdSchema),
    phaseId: t.Optional(queryIdSchema),
    taskId: t.Optional(queryIdSchema),
  }),
  params: t.Object({ id: queryIdSchema }),
}

export type TipModelType = {
  [k in keyof typeof TipModel]: UnwrapSchema<typeof TipModel[k]>
}
