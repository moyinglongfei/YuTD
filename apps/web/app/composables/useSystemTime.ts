export function useSystemTime() {
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

  return { now, update }
}
