<script setup lang="ts">
import { requestApiData } from '~/utils/api'
import { useWrite } from '~/composables/useWrite'

const props = defineProps<{
  phaseId: number
  eventId?: number
}>()

const emit = defineEmits<{
  created: []
}>()

const { $api } = useNuxtApp()

type TaskStatus = NonNullable<Parameters<typeof $api.api.task.post>[0]['status']>

const statuses = [
  { label: '待办', value: 'TODO' },
  { label: '进行中', value: 'DOING' },
  { label: '已完成', value: 'DONE' },
  { label: '已取消', value: 'CANCELLED' }
]

const form = reactive({
  title: '',
  description: '',
  priority: 3,
  dueDate: '',
  reminderTimes: '',
  tags: '',
  status: 'TODO' as TaskStatus
})

const { submitting, submitError, execute } = useWrite(async () => {
  const title = form.title.trim()

  if (!title)
    throw new Error('请输入任务名称')

  if (!Number.isInteger(form.priority))
    throw new Error('优先级必须是整数')

  const dueDate = form.dueDate ? new Date(form.dueDate) : undefined

  if (dueDate && Number.isNaN(dueDate.getTime()))
    throw new Error('截止时间格式无效')

  const reminderTimes = form.reminderTimes.split(/\r?\n/)
    .map(time => time.trim())
    .filter(Boolean)
    .map((time) => {
      const date = new Date(time)

      if (Number.isNaN(date.getTime()))
        throw new Error('提醒时间格式无效')

      return date.toISOString()
    })

  const tags = form.tags.split(/[,，\r\n]+/).map(tag => tag.trim()).filter(Boolean)

  return requestApiData(
    $api.api.task.post({
      title,
      phaseId: props.phaseId,
      eventId: props.eventId,
      description: form.description.trim() || undefined,
      priority: form.priority,
      dueDate: dueDate?.toISOString(),
      reminderTimes: reminderTimes.length ? reminderTimes : undefined,
      tags: tags.length ? tags : undefined,
      status: form.status
    }),
    '创建任务失败'
  )
})

async function submit() {
  const success = await execute()

  if (!success)
    return

  form.title = ''
  form.description = ''
  form.priority = 3
  form.dueDate = ''
  form.reminderTimes = ''
  form.tags = ''
  form.status = 'TODO'
  emit('created')
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold">
        创建任务
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
          label="任务名称"
          required
        >
          <UInput
            v-model="form.title"
            placeholder="例如：完成本周作业"
            class="w-full"
            required
          />
        </UFormField>
        <UFormField label="描述">
          <UTextarea
            v-model="form.description"
            placeholder="选填"
            :rows="2"
            class="w-full"
          />
        </UFormField>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            label="优先级"
            required
          >
            <UInput
              v-model.number="form.priority"
              type="number"
              step="1"
              class="w-full"
              required
            />
          </UFormField>
          <UFormField label="状态">
            <USelect
              v-model="form.status"
              :items="statuses"
              :disabled="submitting"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField label="截止时间">
          <UInput
            v-model="form.dueDate"
            type="datetime-local"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="提醒时间"
          help="每行一个本地日期时间"
        >
          <UTextarea
            v-model="form.reminderTimes"
            placeholder="2026-09-14T09:00"
            :rows="2"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="标签"
          help="用逗号或换行分隔"
        >
          <UTextarea
            v-model="form.tags"
            placeholder="学习, 工作"
            :rows="2"
            class="w-full"
          />
        </UFormField>
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
        {{ submitting ? '创建中……' : '创建任务' }}
      </UButton>
    </form>
  </UCard>
</template>
