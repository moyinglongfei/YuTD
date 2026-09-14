import { t } from 'elysia'
import type { UnwrapSchema } from 'elysia'
import { EventScheduleModel } from '../eventSchedule/model'

export const EventModel = {
  create: t.Object({
    name: t.String({ minLength: 1 }),
    organizer: t.Optional(t.String()),
    location: t.Optional(t.String()),
    color: t.Optional(t.String()),
    phaseId: t.Number(),
    schedules: t.Optional(t.Array(t.Omit(EventScheduleModel.create, ['eventId']))),
  }),
  update: t.Partial(t.Object({
    name: t.String({ minLength: 1 }),
    organizer: t.String(),
    location: t.String(),
    color: t.String(),
    phaseId: t.Number(),
  })),
}

export type EventModelType = {
  [k in keyof typeof EventModel]: UnwrapSchema<typeof EventModel[k]>
}
