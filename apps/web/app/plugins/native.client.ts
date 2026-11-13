import { Capacitor, registerPlugin } from '@capacitor/core'
import { App } from '@capacitor/app'
import { createNativeApi } from '~/api/native'
import type { NativeBridge, NativeCapabilities } from '~/api/native'
import { handlePopupBack } from '~/components/common/AppPopup.vue'

const nativeBridge = registerPlugin<NativeBridge>('YuTD')

export default defineNuxtPlugin({
  name: 'native',
  async setup(nuxtApp) {
    const { reportError } = useAppErrors()
    const { mode } = useSystemStatus()
    const router = useRouter()
    let native: NativeBridge | null = null
    let nativeCapabilities: NativeCapabilities | null = null
    let localApi: ReturnType<typeof createNativeApi> | null = null

    if (Capacitor.getPlatform() === 'android') {
      try {
        let navigating = false
        const listener = await App.addListener('backButton', async ({ canGoBack }) => {
          if (navigating) return
          try {
            if (handlePopupBack()) return
            if (mode.value === 'edit') {
              mode.value = 'normal'
              return
            }
            navigating = true
            if (router.currentRoute.value.path === '/') {
              await App.minimizeApp()
            } else if (canGoBack && router.options.history.state.back) {
              router.back()
              return
            } else {
              await router.replace('/')
            }
          } catch (error) {
            reportError(error, '处理系统返回失败')
          }
          navigating = false
        })
        const resetNavigation = () => {
          navigating = false
        }
        const removeAfterEach = router.afterEach(resetNavigation)
        const removeOnError = router.onError(resetNavigation)
        const cleanup = () => {
          removeAfterEach()
          removeOnError()
          void listener.remove().catch(error => reportError(error, '移除返回键监听失败'))
        }
        nuxtApp.vueApp.onUnmount(cleanup)
        if (import.meta.hot) import.meta.hot.dispose(cleanup)
      } catch (error) {
        reportError(error, '注册返回键监听失败')
      }

      try {
        const capabilities = await nativeBridge.getCapabilities()
        if (capabilities.bridgeVersion !== 1) {
          throw new Error('当前前端不支持此原生桥接版本，请安装匹配的应用版本')
        }
        native = nativeBridge
        nativeCapabilities = capabilities
        if (['preferences', 'styles', 'dataVersion', 'phases', 'events', 'schedules', 'tasks', 'tips', 'resources', 'images', 'config', 'auth'].every(feature => capabilities.features.includes(feature))) {
          localApi = createNativeApi(nativeBridge)
        } else {
          throw new Error('当前原生版本缺少所需接口，请安装新版 Android 应用')
        }
      } catch (error) {
        reportError(error, '原生桥接初始化失败')
      }
    }

    return { provide: { native, nativeCapabilities, localApi } }
  }
})
