export function useSystemTime() {
  const preferencesClient = useApi({
    key: () => 'preferences',
    read: api => api.api.preferences.get()
  })

  const preferences = preferencesClient.data
  const timeZone = computed(() => preferences.value?.timeZone ?? 'UTC')
  const timestamp = useState<number | null>(
    'system-time',
    () => null
  )

  const now = computed(() => {
    return timestamp.value === null
      ? null
      : new Date(timestamp.value)
  })
  function update() {
    timestamp.value = Date.now()
  }

  return { now, timeZone, update }
}
