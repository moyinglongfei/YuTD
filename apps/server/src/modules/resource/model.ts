import { t } from 'elysia'

export const ResourceModel = {
  query: t.Object({
    type: t.Optional(t.Union([
      t.Literal('all'), t.Literal('image'), t.Literal('task'), t.Literal('event'),
      t.Literal('phase'), t.Literal('tip'), t.Literal('style'),
    ])),
    sort: t.Optional(t.Union([t.Literal('updatedAt'), t.Literal('createdAt')])),
    search: t.Optional(t.String({ maxLength: 120 })),
    tag: t.Optional(t.String({ maxLength: 120 })),
    limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
    offset: t.Optional(t.Numeric({ minimum: 0, multipleOf: 1 })),
  }),
}
