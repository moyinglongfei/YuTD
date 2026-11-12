import { Capacitor, registerPlugin } from '@capacitor/core'
import { createNativeApi } from '~/api/native'
import type { NativeBridge, NativeCapabilities } from '~/api/native'

const nativeBridge = registerPlugin<NativeBridge>('YuTD')

export default defineNuxtPlugin({
  name: 'native',
  async setup() {
    const { reportError } = useAppErrors()
    let native: NativeBridge | null = null
    let nativeCapabilities: NativeCapabilities | null = null
    let localApi: ReturnType<typeof createNativeApi> | null = null

    if (Capacitor.getPlatform() === 'android') {
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
