import { t } from 'elysia'

const dateSchema = t.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' })

export const PhaseModel = {
  create: t.Object({
    name: t.String({ minLength: 1 }),
    startDate: dateSchema,
    endDate: dateSchema,
  }),
  update: t.Partial(t.Object({
    name: t.String({ minLength: 1 }),
    startDate: dateSchema,
    endDate: dateSchema,
  })),
}
