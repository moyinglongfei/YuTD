import { Elysia } from 'elysia'
import { ConfigModel } from './model'
import { ConfigService } from './service'

export const configRoutes = new Elysia({ prefix: '/api/config' })

  .get('/', () => ConfigService.getPublic())
  .patch('/', ({ body }) => {
    ConfigService.update(body)
    return ConfigService.getPublic()
  }, {
    body: ConfigModel.newConfig,
  })
