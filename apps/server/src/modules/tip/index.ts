import { Elysia } from 'elysia'
import { TipModel } from './model'
import { TipService } from './service'

export const tipRoutes = new Elysia({ prefix: '/api/tip' })
  .get('/', ({ query }) => TipService.findMany(query), { query: TipModel.query })
  .get('/:id', ({ params }) => TipService.getById(params.id), { params: TipModel.params })
  .post('/', ({ body }) => TipService.create(body), { body: TipModel.create })
  .patch('/:id', ({ params, body }) => TipService.update(params.id, body), {
    params: TipModel.params,
    body: TipModel.update,
  })
  .delete('/:id', ({ params }) => TipService.delete(params.id), { params: TipModel.params })
