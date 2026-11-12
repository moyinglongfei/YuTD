import { createNativeFetcher } from '../api/native'
import type { NativeBridge } from '../api/native'
import { createWebApi } from '../api/web'

export function createApi(options: {
  baseUrl: string
  getAuthToken: () => string | null | undefined
  native?: NativeBridge | null
}) {
  // undefined 使用 Web；null 表示原生初始化失败，不能退回 Web 数据源。
  const fetcher = options.native === undefined ? undefined : createNativeFetcher(options.native)
  return createWebApi(options.baseUrl, options.getAuthToken, fetcher)
}

export async function requestApiData<Response>(
  request: Promise<Response>,
  fallbackMessage = '请求失败'
): Promise<ApiValue<Response>> {
  const response = await request

  // Eden 的响应包含 data、error、status；普通数据没有这一层包装。
  const isEdenResponse = response !== null
    && typeof response === 'object'
    && 'data' in response
    && 'error' in response
    && 'status' in response

  if (!isEdenResponse) {
    return unwrapApiData(response) as ApiValue<Response>
  }

  if (response.error) {
    const message = getApiErrorMessage(response.error, fallbackMessage)
    const error = new Error(message)
    Object.assign(error, { statusCode: response.status })
    throw error
  }

  if (response.data == null && response.status !== 204) {
    throw new Error(fallbackMessage)
  }

  return unwrapApiData(response.data) as ApiValue<Response>
}

export function unwrapApiData<Data>(value: Data | ApiEnvelope<Data>): Data {
  const isWrappedData = value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && 'code' in value
    && 'data' in value

  if (isWrappedData) {
    return (value as ApiEnvelope<Data>).data
  }

  return value as Data
}

// 错误可能是字符串，也可能放在 error.value 或 error.message 里。
function getApiErrorMessage(error: unknown, fallbackMessage: string): string {
  if (typeof error === 'string' && error) {
    return error
  }

  if (error === null || typeof error !== 'object') {
    return fallbackMessage
  }

  // Eden 会把服务器返回的错误放进 value，再进去找一次消息。
  if ('value' in error) {
    return getApiErrorMessage(error.value, fallbackMessage)
  }

  if ('message' in error && typeof error.message === 'string' && error.message) {
    return error.message
  }

  return fallbackMessage
}

// 以下都是 TypeScript 类型说明，不会发请求，也不会处理实际数据。

// 服务器的业务包装。例如 ApiEnvelope<Task[]> 的 data 就是 Task[]。
interface ApiEnvelope<BusinessData> {
  code: number
  message: string
  data: BusinessData
}

// Eden 的外层响应。请求失败时，data 可能为 null。
interface ApiResult<ResponseBody> {
  data: ResponseBody | null
  error: unknown
  status: number
}

// 如果数据带有服务器包装，就取出包装内的类型；否则保留原类型。
// infer BusinessData 的意思是：让 TypeScript 推导 data 里装的是什么类型。
type UnwrappedApiData<ResponseBody> = ResponseBody extends ApiEnvelope<infer BusinessData>
  ? BusinessData
  : ResponseBody

// 从请求结果推导业务数据类型：先去掉 Eden 外层，再去掉服务器包装。
// NonNullable 表示去掉 Eden 外层 data 的 null 和 undefined。
export type ApiValue<Response> = Response extends ApiResult<infer ResponseBody>
  ? UnwrappedApiData<NonNullable<ResponseBody>>
  : UnwrappedApiData<Response>

// 两端共用同一套接口类型，实际传输方式由 createApi 决定。
export type Api = ReturnType<typeof createApi>

// 从接口方法推导业务数据类型。例如 ApiData<Api['api']['task']['get']>。
// 依次读取：方法的返回类型 → 等待 Promise 后的类型 → 外层 data → 业务数据。
export type ApiData<Method>
  = Method extends (...args: infer _Args) => infer Response
    ? ApiValue<Awaited<Response>>
    : never
