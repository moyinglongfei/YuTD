import { fileURLToPath } from 'node:url'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui'
  ],
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
    '~/assets/css/main.css',
    '~/assets/css/schedule.css',
    '~/assets/css/pages/schedule.css',
    '~/assets/css/pages/edit.css',
    '~/assets/css/pages/setting.css'
  ],
  ui: {
    colorMode: false
  },
  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:3000'
    }
  },
  alias: {
    '#backend': fileURLToPath(new URL('../server/src', import.meta.url)),
    '#prisma': fileURLToPath(new URL('../server/generated/prisma', import.meta.url))
  },

  routeRules: {
    '/': { prerender: true }
  },

  compatibilityDate: '2026-06-30',
  nitro: {
    preset: 'Bun'
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
