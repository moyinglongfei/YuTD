import { t } from 'elysia'

const timeSchema = t.String({ pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' })
const weekTypeSchema = t.Union([
  t.Literal('ALL'),
  t.Literal('ODD'),
  t.Literal('EVEN'),
])

export const EventScheduleModel = {
  create: t.Object({
    eventId: t.Number(),
    weekday: t.Number({ minimum: 1, maximum: 7 }),
    startTime: timeSchema,
    endTime: timeSchema,
    startWeek: t.Number({ minimum: 1 }),
    endWeek: t.Number({ minimum: 1 }),
    weekType: t.Optional(weekTypeSchema),
    location: t.Optional(t.String()),
  }),
}
