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
}) {
  const { $api } = useNuxtApp()
  const { reportError } = useAppErrors()
  const key = computed(() => typeof options.key === 'function' ? options.key() : options.key)
  const cache = useState<Record<string, ApiReadCache>>('api:read-cache', () => ({}))
  const data = computed(() => cache.value[key.value]?.data as ApiValue<ReadResponse> | undefined)

  return {
    key,
    data,
    read: () => readApi($api, options.read, reportError, key, cache),
    write: (data: WriteData) => writeApi($api, options.write, data, reportError)
  }
}
