import process from 'node:process'
import { extname, join } from 'node:path'
import { staticPlugin } from '@elysia/static'
import { Elysia } from 'elysia'
import { serverDirectory } from './paths'

export const frontendPlugin = new Elysia({ name: 'frontend' })
  .use((app) => {
    if (process.argv.includes('--dev')) return app

    const webDirectory = join(serverDirectory, 'web')
    const webIndex = Bun.file(join(webDirectory, 'index.html'))

    return app
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
  })
