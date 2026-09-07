import { treaty } from '@elysia/eden'
import type { App } from '@yutd/server'

export default defineNuxtPlugin(() => {
  const api = treaty<App>('http://localhost:3000')

  return {
    provide: {
      api
    }
  }
})
