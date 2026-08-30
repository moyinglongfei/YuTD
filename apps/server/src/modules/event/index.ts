import { Elysia, t } from 'elysia'
import { EventModel } from './model'
import { EventService } from './service'

const idParams = t.Object({ id: t.Numeric() })

export const eventRoutes = new Elysia({ prefix: '/api/event' })
  .get('/', ({ query }) => EventService.getAll(query.phaseId), {
    query: t.Object({ phaseId: t.Optional(t.Numeric()) }),
  })
  .post('/', ({ body }) => EventService.create(body), { body: EventModel.create })
  .patch('/:id', ({ params, body }) => EventService.update(params.id, body), {
    params: idParams,
    body: EventModel.update,
  })
  .delete('/:id', ({ params }) => EventService.delete(params.id), { params: idParams })
