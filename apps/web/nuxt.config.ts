import { fileURLToPath } from 'node:url'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/icon'
  ],
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
  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:3000'
    }
  },
  dir: {
    shared: '../../shared'
  },
  alias: {
    '#backend': fileURLToPath(new URL('../server/src', import.meta.url)),
    '#prisma': fileURLToPath(new URL('../server/generated/prisma', import.meta.url))
  },

  compatibilityDate: '2026-06-30',
  nitro: {
    preset: 'Bun',
    // 将运行依赖打入产物，避免 Windows 创建符号链接失败后发布包缺失依赖。
    noExternals: true
  },
  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
