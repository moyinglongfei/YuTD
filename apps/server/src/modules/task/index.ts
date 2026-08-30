import { Elysia } from 'elysia'
import { TaskModel } from './model'
import { TaskService } from './service'

export const taskRoutes = new Elysia({ prefix: '/api/task' })
  .get('/', ({ query }) => TaskService.findMany(query), {
    query: TaskModel.query,
  })
  .post('/', ({ body }) => TaskService.create(body), {
    body: TaskModel.create,
  })
  .patch('/:id', ({ params, body }) => TaskService.update(Number(params.id), body), {
    body: TaskModel.update,
  })
