import { Capacitor, registerPlugin } from '@capacitor/core'

interface NativeCapabilities {
  bridgeVersion: number
  features: string[]
}

interface NativeBridge {
  getCapabilities(): Promise<NativeCapabilities>
}

const nativeBridge = registerPlugin<NativeBridge>('YuTD')

export default defineNuxtPlugin(async () => {
  const { reportError } = useAppErrors()
  let native: NativeBridge | null = null
  let nativeCapabilities: NativeCapabilities | null = null

  if (Capacitor.getPlatform() === 'android') {
    try {
      const capabilities = await nativeBridge.getCapabilities()
      if (capabilities.bridgeVersion !== 1) {
        throw new Error('当前前端不支持此原生桥接版本，请安装匹配的应用版本')
      }
      native = nativeBridge
      nativeCapabilities = capabilities
    } catch (error) {
      reportError(error, '原生桥接初始化失败')
    }
  }

  return { provide: { native, nativeCapabilities } }
})
