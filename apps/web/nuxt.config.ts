import { fileURLToPath } from 'node:url'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint'
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
    '~/assets/css/main.css'
  ],
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
