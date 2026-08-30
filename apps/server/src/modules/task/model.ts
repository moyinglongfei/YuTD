import { t } from 'elysia'

const todoStatusSchema = t.Union([
  t.Literal('TODO'),
  t.Literal('DOING'),
  t.Literal('DONE'),
  t.Literal('CANCELLED'),
])

export const TaskModel = {
  create: t.Object({
    title: t.String(),
    description: t.Optional(t.String()),
    priority: t.Optional(t.Number()),
    dueDate: t.Optional(t.String()),
    phaseId: t.Number(),
    eventId: t.Optional(t.Number()),
    status: t.Optional(todoStatusSchema),
  }),
  query: t.Object({
    status: t.Optional(todoStatusSchema),
    phaseId: t.Optional(t.Numeric()),
    eventId: t.Optional(t.Numeric()),
    tag: t.Optional(t.String()),
  }),

  update: t.Partial(
    t.Object({
      title: t.String(),
      description: t.String(),
      priority: t.Number(),
      dueDate: t.String(),
      phaseId: t.Number(),
      eventId: t.Number(),
      status: todoStatusSchema,
      isDone: t.Boolean(),
    }),
  ),
}
