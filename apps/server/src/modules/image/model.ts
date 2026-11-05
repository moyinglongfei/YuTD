import { t } from 'elysia'
import { MAX_IMAGE_BYTES } from '#shared/images'

export const ImageModel = {
  params: t.Object({ id: t.String({ format: 'uuid' }) }),
  backgroundQuery: t.Object({ backgroundKey: t.String({ minLength: 1, maxLength: 240 }) }),
  background: t.Object({
    backgroundKey: t.String({ minLength: 1, maxLength: 240 }),
    imageId: t.String({ format: 'uuid' }),
    position: t.Optional(t.Object({
      originalWidth: t.Number({ exclusiveMinimum: 0 }), originalHeight: t.Number({ exclusiveMinimum: 0 }),
      x: t.Number({ minimum: 0 }), y: t.Number({ minimum: 0 }),
      width: t.Number({ exclusiveMinimum: 0 }), height: t.Number({ exclusiveMinimum: 0 })
    }))
  }),
  random: t.Object({ random: t.String({ pattern: '^\\d{1,20}$' }) }),
  randomQuery: t.Object({ backgroundKey: t.Optional(t.String({ minLength: 1, maxLength: 240 })) }),
  rotation: t.Object({
    images: t.Array(t.Object({ id: t.String({ format: 'uuid' }), enabled: t.Boolean() })),
    reshuffle: t.Optional(t.Boolean())
  }),
  upload: t.Object({
    file: t.File({ minSize: 1, maxSize: MAX_IMAGE_BYTES }),
    thumbnail: t.File({ minSize: 1, maxSize: MAX_IMAGE_BYTES }),
  }),
  list: t.Object({
    limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1, default: 24 })),
    offset: t.Optional(t.Numeric({ minimum: 0, multipleOf: 1, default: 0 })),
    search: t.Optional(t.String({ maxLength: 120 })),
  }),
}
