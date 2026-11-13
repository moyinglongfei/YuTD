import { useApi } from '../useApi'

type Preferences = ApiData<Api['api']['preferences']['get']>

const appPreferences = new WeakMap<ReturnType<typeof useNuxtApp>, ReturnType<typeof createAppPeferences>>()

function createAppPeferences() {
  const preferences = useState<Preferences | null>('app:preferences', () => null)
  const client = useApi({
    key: 'preferences',
    read: api => api.api.preferences.get(),
    write: (api, value: Preferences) => api.api.preferences.put(value)
  })
  let initialized = false
  let writing: Promise<unknown> = Promise.resolve()

  watch(preferences, (value) => {
    if (!initialized || !value) return
    const snapshot = { ...value }
    // 按修改顺序保存，响应不回填，避免覆盖前端的新修改。
    writing = writing.then(() => client.write(snapshot)).catch(() => {})
  }, { deep: true, flush: 'sync' })

  async function initialize() {
    initialized = false
    preferences.value = await client.read()
    initialized = true
  }

  return { preferences, loading: client.read.loading, saving: client.write.saving, initialize }
}

export function useAppPeferences() {
  const app = useNuxtApp()
  let preferences = appPreferences.get(app)
  if (!preferences) {
    // 同一应用共用客户端，直接复用 useApi 的读写状态。
    preferences = createAppPeferences()
    appPreferences.set(app, preferences)
  }
  return preferences
}
