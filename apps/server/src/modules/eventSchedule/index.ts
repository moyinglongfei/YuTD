import { Elysia, t } from 'elysia'
import { EventScheduleModel } from './model'
import { EventScheduleService } from './service'

export const eventScheduleRoutes = new Elysia({ prefix: '/api/event-schedule' })
  .get('/', ({ query }) => EventScheduleService.getAll(query.phaseId), {
    query: t.Object({ phaseId: t.Optional(t.Numeric()) }),
  })
  .post('/', ({ body }) => EventScheduleService.create(body), {
    body: EventScheduleModel.create,
  })
  .delete('/:id', ({ params }) => EventScheduleService.delete(params.id), {
    params: t.Object({ id: t.Numeric() }),
  })
