<script setup lang="ts">
import { requestApiData } from '~/utils/api'
import { useWrite } from '~/composables/useWrite'

const emit = defineEmits<{
  created: []
}>()

const form = reactive({
  name: '',
  startDate: '',
  endDate: ''
})

const { $api } = useNuxtApp()

const { submitting, submitError, execute } = useWrite(async () => {
  const name = form.name.trim()

  if (!name)
    throw new Error('请输入阶段名称')

  if (!form.startDate || !form.endDate)
    throw new Error('请选择开始日期和结束日期')

  const startDate = new Date(`${form.startDate}T00:00:00.000Z`)
  const endDate = new Date(`${form.endDate}T00:00:00.000Z`)

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()))
    throw new Error('日期格式无效')

  if (startDate.getUTCDay() !== 1)
    throw new Error('阶段开始日期必须是周一')

  if (endDate.getUTCDay() !== 0)
    throw new Error('阶段结束日期必须是周日')

  if (endDate < startDate)
    throw new Error('阶段结束日期不能早于开始日期')

  return requestApiData(
    $api.api.phase.post({
      name,
      startDate: form.startDate,
      endDate: form.endDate
    }),
    '创建阶段失败'
  )
})

async function submit() {
  const success = await execute()

  if (!success)
    return

  form.name = ''
  form.startDate = ''
  form.endDate = ''
  emit('created')
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold">
        创建阶段
      </h2>
    </template>

    <form
      class="space-y-4"
      @submit.prevent="submit"
    >
      <fieldset
        :disabled="submitting"
        class="space-y-4"
      >
        <UFormField
          label="阶段名称"
          required
        >
          <UInput
            v-model="form.name"
            placeholder="例如：2026 秋季学期"
            class="w-full"
            required
          />
        </UFormField>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            label="开始日期"
            help="请选择周一"
            required
          >
            <UInput
              v-model="form.startDate"
              type="date"
              class="w-full"
              required
            />
          </UFormField>
          <UFormField
            label="结束日期"
            help="请选择周日"
            required
          >
            <UInput
              v-model="form.endDate"
              type="date"
              :min="form.startDate || undefined"
              class="w-full"
              required
            />
          </UFormField>
        </div>
      </fieldset>

      <UAlert
        v-if="submitError"
        color="error"
        variant="soft"
        :title="submitError"
      />
      <UButton
        type="submit"
        :loading="submitting"
        :disabled="submitting"
      >
        {{ submitting ? '创建中……' : '创建阶段' }}
      </UButton>
    </form>
  </UCard>
</template>
