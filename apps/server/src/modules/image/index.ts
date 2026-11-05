import { Elysia } from 'elysia'
import { ImageModel } from './model'
import { ImageService } from './service'
import { ImageBackgroundService } from './background'

export const imageRoutes = new Elysia({ prefix: '/api/image' })
  .get('/background', ({ query, set }) => {
    set.headers['cache-control'] = 'no-store'
    return ImageBackgroundService.get(query.backgroundKey)
  }, { query: ImageModel.backgroundQuery })
  .patch('/background', ({ body }) => ImageBackgroundService.bind(body.backgroundKey, body.imageId, body.position), { body: ImageModel.background })
  .get('/random', () => ImageService.rotation())
  .patch('/random', ({ body }) => ImageService.updateRotation(body.images, body.reshuffle), { body: ImageModel.rotation })
  .get('/random/:random', ({ params, query, set }) => {
    set.headers['cache-control'] = 'no-store'
    return ImageBackgroundService.random(params.random, query.backgroundKey)
  }, { params: ImageModel.random, query: ImageModel.randomQuery })
  .get('/', ({ query }) => ImageService.list(query), { query: ImageModel.list })
  .post('/', ({ body, set }) => {
    set.status = 201
    return ImageService.upload(body.file, body.thumbnail)
  }, { body: ImageModel.upload })
  .get('/:id', ({ params }) => ImageService.get(params.id), { params: ImageModel.params })
  .get('/:id/file', ({ params }) => ImageService.file(params.id), { params: ImageModel.params })
  .get('/:id/thumbnail', ({ params }) => ImageService.thumbnail(params.id), { params: ImageModel.params })
  .delete('/:id', ({ params }) => ImageService.remove(params.id), { params: ImageModel.params })
