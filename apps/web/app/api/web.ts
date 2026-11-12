import { treaty } from '@elysia/eden'
import type { App } from '@yutd/server'

export function createWebApi(baseUrl: string, getAuthToken: () => string | null | undefined, fetcher?: typeof fetch) {
  return treaty<App>(baseUrl, {
    fetcher,
    onResponse: response => response.ok && response.headers.get('content-type')?.startsWith('image/')
      ? response.blob()
      : undefined,
    headers: () => {
      const token = getAuthToken()
      return token ? { authorization: `Bearer ${token}` } : {}
    }
  })
}
