import type { UnwrapSchema } from 'elysia'
import { t } from 'elysia'
import { TaskStatus } from '#prisma/enums'

const taskStatusSchema = t.Enum(TaskStatus)

export const TaskModel = {
  attentionState: t.Object({ cleared: t.Union([t.Literal(0), t.Literal(1)]) }),
  postpone: t.Object({ plannedDate: t.String() }),
  create: t.Object({
    title: t.String(),
    description: t.Optional(t.String()),
    priority: t.Optional(t.Number()),
    dueDate: t.String(),
    plannedDate: t.Optional(t.String()),
    reminderTimes: t.Optional(t.Array(t.String())),
    tags: t.Optional(t.Array(t.String())),
    phaseId: t.Number(),
    eventId: t.Optional(t.Number()),
    status: t.Optional(taskStatusSchema),
  }),
  query: t.Object({
    status: t.Optional(taskStatusSchema),
    phaseId: t.Optional(t.Numeric()),
    eventId: t.Optional(t.Numeric()),
    tag: t.Optional(t.String()),
  }),
  dailyAttention: t.Object({
    phase: t.Optional(t.Numeric({ minimum: 1, multipleOf: 1 })),
    date: t.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}(?:[Tt ]\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,9})?(?:[Zz]|[+-]\\d{2}:?\\d{2})?)?$' }),
  }),
  weeklyAttention: t.Object({
    phase: t.Optional(t.Numeric({ minimum: 1, multipleOf: 1 })),
    weekNumber: t.Number(),
  }),

  update: t.Partial(
    t.Object({
      title: t.String(),
      description: t.String(),
      priority: t.Number(),
      dueDate: t.Union([t.String(), t.Null()]),
      plannedDate: t.Union([t.String(), t.Null()]),
      reminderTimes: t.Array(t.String()),
      tags: t.Array(t.String()),
      phaseId: t.Number(),
      eventId: t.Union([t.Number(), t.Null()]),
      status: taskStatusSchema,
      isDone: t.Boolean(),
    }),
  ),
}

export type TaskModelType = {
  [k in keyof typeof TaskModel]: UnwrapSchema<typeof TaskModel[k]>
}
