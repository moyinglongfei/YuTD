import { Elysia } from 'elysia'
import { TipModel } from './model'
import { TipService } from './service'

export const tipRoutes = new Elysia({ prefix: '/api' })
  .get('/dailytips', ({ query }) => TipService.daily(query), { query: TipModel.daily })
  .get('/tip', ({ query }) => TipService.findMany(query), { query: TipModel.query })
  .get('/tip/:id', ({ params }) => TipService.getById(params.id), { params: TipModel.params })
  .post('/tip', ({ body }) => TipService.create(body), { body: TipModel.create })
  .patch('/tip/:id', ({ params, body }) => TipService.update(params.id, body), {
    params: TipModel.params,
    body: TipModel.update,
  })
  .delete('/tip/:id', ({ params }) => TipService.delete(params.id), { params: TipModel.params })
