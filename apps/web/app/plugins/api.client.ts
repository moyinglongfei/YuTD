import { createWebApi } from '~/api/web'
import { requestApiData } from '~/utils/api'

export default defineNuxtPlugin((app) => {
  const router = useRouter()
  const { reportError } = useAppErrors()
  const authToken = useCookie<string | null>('yutd-auth-token', { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 })
  const api = createWebApi(window.location.origin, () => authToken.value)

  app.hook('app:created', async () => {
    const route = router.currentRoute.value
    if (/^\/login\/?$/.test(route.path)) return
    try {
      await requestApiData(api.api.version.get(), '获取服务器版本失败')
    } catch (error) {
      reportError(error, '获取服务器版本失败')
      const status = error && typeof error === 'object' && 'statusCode' in error ? error.statusCode : undefined
      if (status === 401 || status === 403) {
        authToken.value = null
        await app.runWithContext(() => navigateTo({ path: '/login', query: { redirect: route.fullPath } }, { replace: true }))
      }
    }
  })

  return {
    provide: {
      api
    }
  }
})
