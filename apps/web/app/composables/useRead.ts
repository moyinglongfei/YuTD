import type { MaybeRefOrGetter } from 'vue'

export function useRead<T>(key: MaybeRefOrGetter<string>, request: () => Promise<T>) {
  const { data, status, error, refresh, clear } = useAsyncData(key, request, {
    lazy: true
  })

  const loading = computed(() => status.value === 'pending')
  const readError = computed(() => error.value?.message || '')

  return {
    data,
    loading,
    readError,
    refresh,
    clear
  }
}
