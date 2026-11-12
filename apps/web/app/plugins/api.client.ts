import { Capacitor } from '@capacitor/core'
import { createApi, requestApiData } from '~/utils/api'

export default defineNuxtPlugin({
  dependsOn: ['native'],
  setup(app) {
    const router = useRouter()
    const { reportError } = useAppErrors()
    const authToken = useCookie<string | null>('yutd-auth-token', { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 })
    const { $native, $localApi } = useNuxtApp()
    const api = createApi({
      baseUrl: window.location.origin,
      getAuthToken: () => authToken.value,
      native: Capacitor.getPlatform() === 'android' ? ($localApi ? $native : null) : undefined
    })

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
  }
})
