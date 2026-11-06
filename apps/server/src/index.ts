import process from 'node:process'
import { extname, join } from 'node:path'
import { cors } from '@elysiajs/cors'
import { openapi } from '@elysiajs/openapi'
import { staticPlugin } from '@elysia/static'
import { Elysia } from 'elysia'

import { authGuard, getLoginRoutes } from '#backend/lib/auth'
import { configRoutes } from '#backend/modules/config'
import { ConfigService } from '#backend/modules/config/service'
import { eventRoutes } from '#backend/modules/event'
import { eventScheduleRoutes } from '#backend/modules/eventSchedule'
import { phaseRoutes } from '#backend/modules/phase'
import { imageRoutes } from '#backend/modules/image'
import { resourceRoutes } from '#backend/modules/resource'
import { preferencesRoutes } from '#backend/modules/preferences'
import { styleRoutes } from '#backend/modules/style'
import { taskRoutes } from '#backend/modules/task/index'
import { tipRoutes } from '#backend/modules/tip'
import { httpPlugin } from './lib/http'
import { readDataVersion } from './lib/version'
import { serverDirectory } from './lib/paths'

try {
  ConfigService.init()
}
catch (e) {
  console.error((e as Error).message)
  process.exit(1)
}
const config = ConfigService.get()
const webDirectory = join(serverDirectory, 'web')
const webIndex = Bun.file(join(webDirectory, 'index.html'))

const app = new Elysia()
  .use(openapi())// 启用 OpenAPI 支持
  .use(cors())// 允许跨域请求
  .use(httpPlugin) // 启用全局输出处理和日志记录
  .use(getLoginRoutes())
  .guard({}, app => app
    .derive(authGuard)
    .get('/api/version', ({ set }) => {
      set.headers['cache-control'] = 'no-store'
      return readDataVersion()
    })
    .use(phaseRoutes)
    .use(preferencesRoutes)
    .use(eventRoutes)
    .use(eventScheduleRoutes)
    .use(configRoutes)
    .use(styleRoutes)
    .use(imageRoutes)
    .use(resourceRoutes)
    .use(taskRoutes)
    .use(tipRoutes))
  .use(staticPlugin({ assets: webDirectory, prefix: '', alwaysStatic: true, maxAge: 0, directive: 'no-cache' }))
  .get('/*', async ({ request }) => {
    const path = new URL(request.url).pathname
    if (path === '/api' || path.startsWith('/api/'))
      return Response.json({ message: '接口不存在' }, { status: 404 })
    if (extname(path)) return new Response('Not Found', { status: 404 })
    if (!await webIndex.exists())
      return new Response('前端尚未构建，请在项目根目录运行 bun run build。', { status: 503 })
    return new Response(webIndex, { headers: { 'cache-control': 'no-cache' } })
  })

app.listen({ port: config.system.port, hostname: config.system.host }, () => {
  console.warn(`YuTD 运行在 http://${config.system.host}:${config.system.port}`)
})

export type App = typeof app
