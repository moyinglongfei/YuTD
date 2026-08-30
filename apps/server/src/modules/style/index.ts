import { Elysia } from 'elysia'
import { StyleModel } from './model'
import { StyleService } from './service'

export const publicStyleRoutes = new Elysia({ prefix: '/api/style' })
  .get('/public', () => StyleService.get())

export const styleRoutes = new Elysia({ prefix: '/api/style' })
  .get('/', () => StyleService.get())
  .post('/', ({ body }) => StyleService.update(body), {
    body: StyleModel.update,
  })
