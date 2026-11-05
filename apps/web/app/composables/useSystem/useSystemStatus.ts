export type SystemMode = 'normal' | 'edit'

export function useSystemStatus() {
  const mode = useState<SystemMode>('system-status:mode', () => 'normal')

  return { mode }
}
