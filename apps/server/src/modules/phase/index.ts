import { Elysia, t } from 'elysia'
import { PhaseModel } from './model'
import { PhaseService } from './service'

const idParams = t.Object({ id: t.Numeric() })

export const phaseRoutes = new Elysia({ prefix: '/api/phase' })
  .get('/', () => PhaseService.getAll())
  .get('/:id', ({ params }) => PhaseService.getById(params.id), { params: idParams })
  .post('/', ({ body }) => PhaseService.create(body), { body: PhaseModel.create })
  .patch('/:id', ({ params, body }) => PhaseService.update(params.id, body), {
    params: idParams,
    body: PhaseModel.update,
  })
  .delete('/:id', ({ params }) => PhaseService.delete(params.id), { params: idParams })
