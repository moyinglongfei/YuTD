import { treaty } from '@elysia/eden'
import type { App } from '@yutd/server'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const authToken = useCookie<string | null>('yutd-auth-token')
  const api = treaty<App>(config.public.apiBase, {
    headers: () => authToken.value
      ? { authorization: `Bearer ${authToken.value}` }
      : {}
  })

  return {
    provide: {
      api
    }
  }
})
