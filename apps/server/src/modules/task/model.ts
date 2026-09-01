import type { UnwrapSchema } from 'elysia'
import { t } from 'elysia'
import { TaskStatus } from '@/../../generated/prisma/enums'

const taskStatusSchema = t.Enum(TaskStatus)

export const TaskModel = {
  create: t.Object({
    title: t.String(),
    description: t.Optional(t.String()),
    priority: t.Optional(t.Number()),
    dueDate: t.Optional(t.String()),
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

  update: t.Partial(
    t.Object({
      title: t.String(),
      description: t.String(),
      priority: t.Number(),
      dueDate: t.String(),
      reminderTimes: t.Array(t.String()),
      tags: t.Array(t.String()),
      phaseId: t.Number(),
      eventId: t.Number(),
      status: taskStatusSchema,
      isDone: t.Boolean(),
    }),
  ),
}

export type TaskModelType = {
  [k in keyof typeof TaskModel]: UnwrapSchema<typeof TaskModel[k]>
}