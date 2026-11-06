import { createRequire } from 'node:module'
import { cpSync, copyFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const output = fileURLToPath(new URL('../../dist/YuTD/', import.meta.url))
mkdirSync(output, { recursive: true })

const result = await Bun.build({
  entrypoints: [fileURLToPath(new URL('./src/index.ts', import.meta.url))],
  target: 'bun',
  compile: { outfile: join(output, process.platform === 'win32' ? 'server.exe' : 'server') },
  minify: { whitespace: true, syntax: true },
  plugins: [{
    name: 'libsql-native',
    setup(build) {
      build.onLoad({ filter: /[\\/]libsql[\\/]index\.js$/ }, async ({ path }) => {
        const require = createRequire(path)
        let target: string = require('@neon-rs/load').currentTarget()
        const { familySync, GLIBC, MUSL } = require('detect-libc')
        const family = familySync()
        if (family === GLIBC && /^linux-(x64|arm64)-musl$/.test(target))
          target = target.replace(/-musl$/, '-gnu')
        if (family === MUSL && target === 'linux-arm-gnueabihf')
          target = 'linux-arm-musleabihf'
        const source = await Bun.file(path).text()
        const dynamicImport = 'require(`@libsql/${target}`)'
        if (!source.includes(dynamicImport))
          throw new Error('libSQL 加载方式发生变化，请检查二进制打包配置')
        // 将当前平台的动态加载改为静态引用，让 Bun 把原生库一并嵌入。
        return { loader: 'js', contents: source.replace(dynamicImport, `require(${JSON.stringify(require.resolve(`@libsql/${target}`))})`) }
      })
    }
  }]
})
if (!result.success) throw new AggregateError(result.logs, '服务器编译失败')

cpSync(fileURLToPath(new URL('./web/', import.meta.url)), join(output, 'web'), { recursive: true })
copyFileSync(fileURLToPath(new URL('../../config.example.yaml', import.meta.url)), join(output, 'config.example.yaml'))
console.log(`二进制发布文件已生成：${output}`)
