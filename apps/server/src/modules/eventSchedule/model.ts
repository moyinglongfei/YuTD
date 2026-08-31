import { t } from 'elysia'
import type { UnwrapSchema } from 'elysia'

const timeSchema = t.String({ pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' })

export const EventScheduleModel = {
  create: t.Object({
    eventId: t.Number(),
    weekday: t.Number({ minimum: 1, maximum: 7 }),
    startTime: timeSchema,
    endTime: timeSchema,
    weeks: t.Array(t.Integer({ minimum: 1 }), { minItems: 1, uniqueItems: true }),
    location: t.Optional(t.String()),
  }),
}

export type EventScheduleModelType = {
  [k in keyof typeof EventScheduleModel]: UnwrapSchema<typeof EventScheduleModel[k]>
}
