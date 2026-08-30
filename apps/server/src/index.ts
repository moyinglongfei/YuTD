import process from 'node:process'
import { cors } from '@elysiajs/cors'
import { openapi } from '@elysiajs/openapi'
import { Elysia } from 'elysia'

import { authGuard, getLoginRoutes } from '@/lib/auth'
import { configRoutes } from '@/modules/config'
import { ConfigService } from '@/modules/config/service'
import { eventRoutes } from '@/modules/event'
import { eventScheduleRoutes } from '@/modules/eventSchedule'
import { phaseRoutes } from '@/modules/phase'
import { styleRoutes } from '@/modules/style'
import { taskRoutes } from '@/modules/task/index'
import { httpPlugin } from './lib/http'

try {
  ConfigService.init()
}
catch (e) {
  console.error((e as Error).message)
  process.exit(1)
}
const config = ConfigService.get()

const app = new Elysia()
  .use(openapi())// 启用 OpenAPI 支持
  .use(cors())// 允许跨域请求
  .use(httpPlugin) // 启用全局输出处理和日志记录
  .use(getLoginRoutes())
  .guard({}, app => app
    .derive(authGuard)
    .use(phaseRoutes)
    .use(eventRoutes)
    .use(eventScheduleRoutes)
    .use(configRoutes)
    .use(styleRoutes)
    .use(taskRoutes))
  .get('/', () => ({ message: 'YuTD 后端运行正常喵！' }))

app.listen({ port: config.system.port, hostname: config.system.host }, () => {
  console.warn(`YuTD 后端成功运行在 http://${config.system.host}:${config.system.port}`)
})
