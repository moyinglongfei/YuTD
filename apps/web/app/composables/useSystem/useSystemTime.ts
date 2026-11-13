export function useSystemTime() {
  const { preferences } = useAppPeferences()
  const timeZone = computed(() => preferences.value?.timeZone ?? 'UTC')
  const timestamp = useState<number | null>(
    'system-status:time',
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
