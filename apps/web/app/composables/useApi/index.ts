import type { Api, ApiValue } from '../../utils/api.ts'
import { useAppErrors } from '../useApp/useAppErrors.ts'
import { readApi } from './read.ts'
import type { ApiReadCache } from './read.ts'
import { writeApi } from './write.ts'

export type ApiMode = 'local' | 'remote' | 'remote-local'

// 全局模式仅预留选项，目前仍使用 local 的读取方式。
export function useApiMode() {
  return useState<ApiMode>('api:mode', () => 'local')
}

export function useApi<ReadResponse, WriteData = void, WriteResponse = unknown>(options: {
  key: string | (() => string) // useState 缓存 key
  read?: (api: Api) => Promise<ReadResponse> // 读取函数
  write?: (api: Api, data: WriteData) => Promise<WriteResponse> // 写入函数
  watch?: boolean // 首次及 key 改变时自动读取
}) {
  const { $api } = useNuxtApp()
  const { reportError } = useAppErrors()
  const key = computed(() => typeof options.key === 'function' ? options.key() : options.key)
  const cache = useState<Record<string, ApiReadCache>>('api:read-cache', () => ({}))
  const data = computed(() => cache.value[key.value]?.data as ApiValue<ReadResponse> | undefined)

  const readPending = ref(0)
  const read = Object.assign(() => readApi($api, options.read, reportError, key, cache, readPending), {
    loading: computed(() => readPending.value > 0),
    refresh: () => readApi($api, options.read, reportError, key, cache, readPending, true)
  })
  if (options.watch && options.read) {
    watch(key, () => read().catch(() => {}), { immediate: true })
  }

  const writePending = ref(0)
  const write = Object.assign((data: WriteData) => writeApi($api, options.write, data, reportError, writePending), {
    saving: computed(() => writePending.value > 0)
  })

  return {
    key,
    data,
    read,
    write
  }
}
