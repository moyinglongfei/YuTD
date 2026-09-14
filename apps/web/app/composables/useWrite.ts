export function useWrite(request: () => Promise<unknown>) {
  const submitting = ref(false)
  const submitError = ref('')

  async function execute() {
    if (submitting.value)
      return false

    submitting.value = true
    submitError.value = ''

    try {
      await request()
      return true
    } catch (error) {
      submitError.value = error instanceof Error
        ? error.message
        : '提交失败，请稍后重试'

      return false
    } finally {
      submitting.value = false
    }
  }

  return {
    submitting,
    submitError,
    execute
  }
}
