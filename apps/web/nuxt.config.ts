import { fileURLToPath } from 'node:url'
import { readSystemConfig } from '../server/src/lib/config'

const system = readSystemConfig()
const apiHost = ['0.0.0.0', '::', '[::]'].includes(system.host) ? 'localhost' : system.host
const apiAuthority = apiHost.includes(':') && !apiHost.startsWith('[') ? `[${apiHost}]` : apiHost

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/icon'
  ],
  ssr: false,
  components: [
    { path: '~/components/preview/card', pathPrefix: false },
    { path: '~/components/preview', pathPrefix: false },
    { path: '~/components/common', pathPrefix: false },
    { path: '~/components/edit', pathPrefix: false },
    '~/components'
  ],
  imports: {
    dirs: ['~/composables/*/index.ts', '~/composables/useApp', '~/composables/useSystem']
  },
  devtools: {
    enabled: true
  },
  app: {
    head: {
      link: [
        {
          rel: 'icon',
          href: '/logo.svg',
          type: 'image/svg+xml'
        }
      ]
    }
  },
  css: [
    '~/assets/css/main.css'
  ],
  dir: {
    shared: '../../shared'
  },
  alias: {
    '#backend': fileURLToPath(new URL('../server/src', import.meta.url)),
    '#prisma': fileURLToPath(new URL('../server/generated/prisma', import.meta.url))
  },

  compatibilityDate: '2026-06-30',
  nitro: {
    preset: 'static',
    output: { publicDir: fileURLToPath(new URL('../server/web', import.meta.url)) },
    devProxy: {
      '/api': { target: `http://${apiAuthority}:${system.port}/api`, changeOrigin: true }
    },
    rollupConfig: { // 屏蔽 Nitro 生成的缓存驱动和 h3 的警告
      onwarn(warning, warn) {
        const message = warning.message.replace(/\\/g, '/')

        const cacheDriverWarning
          = warning.code === 'UNRESOLVED_IMPORT'
            && message.includes('/@nuxt/nitro-server/dist/runtime/utils/cache-driver.mjs')

        const h3Warning
          = warning.code === 'UNUSED_EXTERNAL_IMPORT'
            && message.includes('/@nuxt/nitro-server/dist/h3.mjs')

        if (cacheDriverWarning || h3Warning) return

        warn(warning)
      }
    }
  },
  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },
  icon: {
    provider: 'none',
    serverBundle: false,
    fallbackToApi: false,
    clientBundle: { scan: { globInclude: ['app/**/*.{vue,ts}'] } }
  }
})
