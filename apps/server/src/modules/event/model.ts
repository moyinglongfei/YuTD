import { t } from 'elysia'

export const EventModel = {
  create: t.Object({
    name: t.String({ minLength: 1 }),
    organizer: t.Optional(t.String()),
    location: t.Optional(t.String()),
    color: t.Optional(t.String()),
    phaseId: t.Number(),
  }),
  update: t.Partial(t.Object({
    name: t.String({ minLength: 1 }),
    organizer: t.String(),
    location: t.String(),
    color: t.String(),
    phaseId: t.Number(),
  })),
}
