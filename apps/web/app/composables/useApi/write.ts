import { requestApiData } from '../../utils/api.ts'
import type { Api, ApiValue } from '../../utils/api.ts'
import type { useAppErrors } from '../useApp/useAppErrors.ts'

export async function writeApi<Data, Response>(
  api: Api,
  request: ((api: Api, data: Data) => Promise<Response>) | undefined,
  data: Data,
  reportError: ReturnType<typeof useAppErrors>['reportError'],
  pending: Ref<number>
): Promise<ApiValue<Response>> {
  try {
    pending.value++
    if (!request) {
      throw new Error('未配置写入方法')
    }
    return await requestApiData(request(api, data), '写入失败')
  } catch (error) {
    reportError(error, '写入失败')
    throw error
  } finally {
    pending.value--
  }
}
