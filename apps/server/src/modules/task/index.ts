import { Elysia } from 'elysia'
import { TaskModel } from './model'
import { TaskService } from './service'

export const taskRoutes = new Elysia({ prefix: '/api' })
  .get('/dailytask', ({ query }) => TaskService.daily(query), { query: TaskModel.dailyAttention })
  .get('/weeklytask', ({ query }) => TaskService.weekly(query), { query: TaskModel.weeklyAttention })
  .patch('/dailytask', ({ query, body }) => TaskService.setAttention(query, false, body.cleared), { query: TaskModel.dailyAttention, body: TaskModel.attentionState })
  .patch('/weeklytask', ({ query, body }) => TaskService.setAttention(query, true, body.cleared), { query: TaskModel.weeklyAttention, body: TaskModel.attentionState })
  .get('/task', ({ query }) => TaskService.findMany(query), {
    query: TaskModel.query,
  })
  .post('/task', ({ body }) => TaskService.create(body), {
    body: TaskModel.create,
  })
  .patch('/task/:id/postpone', ({ params, body }) => TaskService.postpone(Number(params.id), body), {
    body: TaskModel.postpone,
  })
  .patch('/task/:id', ({ params, body }) => TaskService.update(Number(params.id), body), {
    body: TaskModel.update,
  })
