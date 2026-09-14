<script setup lang="ts">
import { requestApiData } from '~/utils/api'
import { useWrite } from '~/composables/useWrite'
import { createScheduleForm, getScheduleData } from '~/utils/schedule'
import ScheduleWrite from '~/components/write/ScheduleWrite.vue'

const props = defineProps<{
  phaseId: number
}>()

const emit = defineEmits<{
  created: []
}>()

const form = reactive({
  name: '',
  organizer: '',
  location: '',
  color: '#6366f1'
})

let nextScheduleId = 1
const schedules = ref([{ id: nextScheduleId++, form: createScheduleForm() }])

function addSchedule() {
  schedules.value.push({ id: nextScheduleId++, form: createScheduleForm() })
}

function removeSchedule(id: number) {
  schedules.value = schedules.value.filter(schedule => schedule.id !== id)
}

const { $api } = useNuxtApp()

const { submitting, submitError, execute } = useWrite(async () => {
  const name = form.name.trim()

  if (!name)
    throw new Error('请输入事件名称')

  const scheduleData = schedules.value.map((schedule, index) => {
    try {
      return getScheduleData(schedule.form)
    } catch (error) {
      throw new Error(`日程 ${index + 1}：${error instanceof Error ? error.message : '请检查日程内容'}`, { cause: error })
    }
  })

  return requestApiData(
    $api.api.event.post({
      name,
      phaseId: props.phaseId,
      organizer: form.organizer.trim() || undefined,
      location: form.location.trim() || undefined,
      color: form.color || undefined,
      schedules: scheduleData
    }),
    '创建事件失败'
  )
})

async function submit() {
  const success = await execute()

  if (!success)
    return

  form.name = ''
  form.organizer = ''
  form.location = ''
  form.color = '#6366f1'
  schedules.value = [{ id: nextScheduleId++, form: createScheduleForm() }]
  emit('created')
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold">
        创建事件
      </h2>
    </template>

    <form
      class="space-y-5"
      @submit.prevent="submit"
    >
      <fieldset
        :disabled="submitting"
        class="grid gap-4 sm:grid-cols-2"
      >
        <UFormField
          label="事件名称"
          required
        >
          <UInput
            v-model="form.name"
            placeholder="例如：高等数学"
            class="w-full"
            required
          />
        </UFormField>
        <UFormField label="组织者">
          <UInput
            v-model="form.organizer"
            placeholder="选填"
            class="w-full"
          />
        </UFormField>
        <UFormField label="事件地点">
          <UInput
            v-model="form.location"
            placeholder="选填"
            class="w-full"
          />
        </UFormField>
        <UFormField label="颜色">
          <UInput
            v-model="form.color"
            type="color"
            class="w-full"
          />
        </UFormField>
      </fieldset>

      <div class="space-y-4">
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-sm font-medium">
            日程（{{ schedules.length }}）
          </h3>
          <UButton
            type="button"
            color="neutral"
            variant="outline"
            icon="i-lucide-plus"
            :disabled="submitting"
            @click="addSchedule"
          >
            添加日程
          </UButton>
        </div>

        <div
          v-for="(schedule, index) in schedules"
          :key="schedule.id"
          class="space-y-4 rounded-lg border border-default p-4"
        >
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-medium">
              日程 {{ index + 1 }}
            </p>
            <UButton
              type="button"
              color="error"
              variant="ghost"
              size="sm"
              :disabled="submitting"
              :aria-label="`移除日程 ${index + 1}`"
              @click="removeSchedule(schedule.id)"
            >
              移除
            </UButton>
          </div>
          <ScheduleWrite
            v-model="schedule.form"
            :disabled="submitting"
          />
        </div>

        <p
          v-if="!schedules.length"
          class="rounded-lg border border-dashed border-default p-4 text-sm text-muted"
        >
          暂无日程，可以先创建事件，稍后再安排时间。
        </p>
      </div>

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
        {{ submitting ? '创建中……' : '创建事件与日程' }}
      </UButton>
    </form>
  </UCard>
</template>
