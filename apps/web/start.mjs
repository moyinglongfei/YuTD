import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { file, spawn, YAML } from 'bun'

const config = file(new URL('../../config.yaml', import.meta.url))
const example = file(new URL('../../config.example.yaml', import.meta.url))
const { system } = YAML.parse(await (await config.exists() ? config : example).text())
const webPort = system.webPort ?? 3001
if (!Number.isInteger(webPort) || webPort < 1 || webPort > 65535)
  throw new Error('config.yaml 的 system.webPort 必须是 1–65535 的整数')

// 环境变量可覆盖根目录配置；未显式设置 API 地址时跟随后端端口。
process.env.NITRO_PORT ||= process.env.PORT || String(webPort)
process.env.NITRO_HOST ||= process.env.HOST || system.webHost || 'localhost'
const apiHost = ['0.0.0.0', '::', '[::]'].includes(system.host) ? 'localhost' : system.host
const apiAuthority = apiHost.includes(':') && !apiHost.startsWith('[') ? `[${apiHost}]` : apiHost
process.env.NUXT_PUBLIC_API_BASE ||= `http://${apiAuthority}:${system.port}`
if (process.argv.includes('--dev')) {
  const development = spawn([
    process.execPath,
    fileURLToPath(new URL('./node_modules/nuxt/bin/nuxt.mjs', import.meta.url)),
    'dev', '--port', process.env.NITRO_PORT, '--host', process.env.NITRO_HOST
  ], { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' })
  process.once('SIGINT', () => development.kill('SIGINT'))
  process.once('SIGTERM', () => development.kill('SIGTERM'))
  process.exit(await development.exited)
} else {
  await import('./.output/server/index.mjs')
}
