import { Elysia } from 'elysia'
import { PreferencesModel } from './model'
import { PreferencesService } from './service'

export const preferencesRoutes = new Elysia({ prefix: '/api/preferences' })
  .get('/', () => PreferencesService.get())
  .patch('/', ({ body }) => PreferencesService.update(body), {
    body: PreferencesModel.update,
  })
  .put('/', ({ body }) => PreferencesService.replace(body), {
    body: PreferencesModel.replace,
  })
  .post('/reset', () => PreferencesService.reset())
