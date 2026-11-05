import { requestApiData } from '../../utils/api.ts'
import type { Api, ApiValue } from '../../utils/api.ts'
import type { useAppErrors } from '../useApp/useAppErrors.ts'

export interface ApiReadCache {
  version: string
  data: unknown
}

// 每个应用的 $api 各自共享正在进行的版本请求，避免服务端不同用户串用。
const versionRequests = new WeakMap<Api, Promise<{ version: string }>>()

function getVersion(api: Api) {
  const pendingVersion = versionRequests.get(api)
  if (pendingVersion) {
    return pendingVersion
  }

  const request = requestApiData(api.api.version.get(), '获取数据版本失败').finally(() => {
    versionRequests.delete(api)
  })
  versionRequests.set(api, request)
  return request
}

export async function readApi<Response>(
  api: Api,
  request: ((api: Api) => Promise<Response>) | undefined,
  reportError: ReturnType<typeof useAppErrors>['reportError'],
  key: Readonly<Ref<string>>,
  cache: Ref<Record<string, ApiReadCache>>
): Promise<ApiValue<Response>> {
  try {
    if (!request) throw new Error('未配置读取方法')
    // 先查版本，再读取当前 key，确保动态 key 与随后发出的请求一致。
    const { version } = await getVersion(api)
    const cacheKey = key.value
    const cached = cache.value[cacheKey]

    if (cached && cached.version === version) {
      return cached.data as ApiValue<Response>
    }

    // 没有缓存或版本变化：重新读取，成功后一起保存数据与版本。
    const data = await requestApiData(request(api), '读取失败')
    cache.value = { ...cache.value, [cacheKey]: { version, data } }
    return data
  } catch (error) {
    if (!(error instanceof Error && error.name === 'AbortError')) reportError(error, '读取失败')
    throw error
  }
}
