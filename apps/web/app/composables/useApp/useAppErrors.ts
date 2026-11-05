export interface AppError {
  id: number
  source: string
  message: string
  count: number
}

export function useAppErrors() {
  const errors = useState<AppError[]>('app:errors', () => [])

  function reportError(error: unknown, source = '发生错误') {
    const message = typeof error === 'string'
      ? error
      : error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : '未知错误'
    const existing = errors.value.find(item => item.source === source && item.message === message)
    if (existing) {
      existing.count++
      return
    }
    const id = (errors.value.at(-1)?.id ?? 0) + 1
    errors.value.push({ id, source, message, count: 1 })
    if (errors.value.length > 50)
      errors.value.shift()
  }

  function dismissError(id: number) {
    errors.value = errors.value.filter(item => item.id !== id)
  }

  function clearErrors() {
    errors.value = []
  }

  return { errors, reportError, dismissError, clearErrors }
}
