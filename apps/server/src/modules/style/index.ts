import { Elysia, t } from 'elysia'
import { StyleModel } from './model'
import { StyleService } from './service'

const params = t.Object({ id: t.Numeric({ minimum: 1 }) })
export const styleRoutes = new Elysia({ prefix: '/api/style' })
  .get('/', () => StyleService.list())
  .post('/', ({ body }) => StyleService.create(body), { body: StyleModel.create })
  .get('/:id', ({ params }) => StyleService.get(params.id), { params })
  .patch('/:id', ({ params, body }) => StyleService.update(params.id, body), {
    params, body: StyleModel.update,
  })
