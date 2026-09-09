interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
}

interface ApiResult<T> {
  data: T | null
  error: unknown
  status: number
}

type UnwrappedApiData<T> = T extends ApiEnvelope<infer Data> ? Data : T

export function unwrapApiData<T>(value: T | ApiEnvelope<T>) {
  if (
    value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && 'code' in value
    && 'data' in value
  ) {
    return (value as ApiEnvelope<T>).data
  }

  return value as T
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'string' && error)
    return error

  if (!error || typeof error !== 'object')
    return fallback

  if ('value' in error)
    return getApiErrorMessage(error.value, fallback)

  if ('message' in error && typeof error.message === 'string' && error.message)
    return error.message

  return fallback
}

export async function requestApiData<T>(
  request: Promise<ApiResult<T>>,
  fallbackMessage = '请求失败'
): Promise<UnwrappedApiData<T>> {
  const result = await request

  if (result.error) {
    const error = new Error(getApiErrorMessage(result.error, fallbackMessage))
    Reflect.set(error, 'statusCode', result.status)
    throw error
  }

  if (result.data === null)
    throw new Error(fallbackMessage)

  return unwrapApiData(result.data) as UnwrappedApiData<T>
}
