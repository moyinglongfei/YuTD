interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
}

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
