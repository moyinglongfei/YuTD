import { Elysia } from 'elysia'
import { ResourceModel } from './model'
import { ResourceService } from './service'

export const resourceRoutes = new Elysia({ prefix: '/api/resource' })
  .get('/', ({ query }) => ResourceService.list(query), { query: ResourceModel.query })
