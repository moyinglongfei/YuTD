import type { UnwrapSchema } from 'elysia'
import { t } from 'elysia'

export const ConfigModel = {
  config: t.Object({
    system: t.Object({
      host: t.String(),
      port: t.Number(),
    }),

    auth: t.Object({
      enabled: t.Boolean(),
      password: t.String(),
      expiresIn: t.String(),
      secret: t.String(),
    }),

    features: t.Object({
      enableReminder: t.Boolean(),
    }),
  }),

  publicConfig: t.Object({
    system: t.Object({
      host: t.String(),
      port: t.Number(),
    }),

    auth: t.Object({
      enabled: t.Boolean(),
      expiresIn: t.String(),
    }),

    features: t.Object({
      enableReminder: t.Boolean(),
    }),
  }),

  newConfig: t.Partial(
    t.Object({
      system: t.Partial(t.Object({
        host: t.String(),
        port: t.Number(),
      })),

      auth: t.Partial(t.Object({
        enabled: t.Boolean(),
        password: t.String(),
        expiresIn: t.String(),
      })),

      features: t.Partial(t.Object({
        enableReminder: t.Boolean(),
      })),
    }),
  ),
} as const

export type ConfigModelType = {
  [k in keyof typeof ConfigModel]: UnwrapSchema<typeof ConfigModel[k]>
}
