export default defineNuxtPlugin((app) => {
  const { reportError } = useAppErrors()
  app.hook('vue:error', error => reportError(error, '页面运行失败'))
  app.hook('app:error', error => reportError(error, '应用运行失败'))
  if (import.meta.client) {
    window.addEventListener('unhandledrejection', event => reportError(event.reason, '异步操作失败'))
    window.addEventListener('error', event => reportError(event.error ?? event.message, '页面运行失败'))
  }
})
