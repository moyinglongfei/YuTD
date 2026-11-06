import { Elysia } from 'elysia'
import {
  HttpException,
  httpExceptionPlugin,
} from 'elysia-http-exception'
import logixlysia from 'logixlysia'
import { bumpDataVersion } from './version'

const elysiaErrorStatus = {
  VALIDATION: 400,
  PARSE: 400,
  INVALID_COOKIE_SIGNATURE: 400,
  INVALID_FILE_TYPE: 415,
  NOT_FOUND: 404,
} as const

export const httpPlugin = new Elysia({
  name: 'http-plugin',
})
  .onError({ as: 'global' }, ({ code, error, set }) => {
    const statusCode = error instanceof HttpException
      ? error.statusCode
      : typeof code === 'string' && code in elysiaErrorStatus
        ? elysiaErrorStatus[code as keyof typeof elysiaErrorStatus]
        : undefined

    if (statusCode) {
      set.status = statusCode
      Reflect.set(error, 'status', statusCode)
    }
  })
  .use(
    logixlysia({
      config: {
        service: 'api-server',
        showStartupMessage: false,
        showContextTree: true,
        contextDepth: 2,
        slowThreshold: 500,
        verySlowThreshold: 1000,
        timestamp: {
          translateTime: 'yyyy-mm-dd HH:MM:ss.SSS',
        },
        ip: true,
      },
    }).as('global'),
  )
  .use(httpExceptionPlugin())
  .onAfterHandle({
    as: 'global',
  }, async ({ responseValue, set, request }) => {
    const path = new URL(request.url).pathname
    if (path !== '/api' && !path.startsWith('/api/'))
      return responseValue

    const statusCode = responseValue instanceof Response
      ? responseValue.status
      : typeof set.status === 'number' ? set.status : 200

    if (statusCode < 400 && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
      && new URL(request.url).pathname.startsWith('/api/'))
      await bumpDataVersion()

    if (responseValue instanceof Response)
      return responseValue

    if (statusCode >= 400 || statusCode === 204)
      return responseValue

    return {
      code: 0,
      message: 'ok',
      data: responseValue ?? null,
    }
  })
  .as('global')
