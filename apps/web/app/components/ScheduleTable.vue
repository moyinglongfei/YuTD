<script setup lang="ts">
import { computed } from 'vue'
import { unwrapApiData } from '~/utils/api'

const props = defineProps<{
  phaseId: number
}>()

const dayStart = 8
const dayEnd = 22
const hourHeight = 72
const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const hours = Array.from({ length: dayEnd - dayStart + 1 }, (_, index) => index + dayStart)
const boardHeight = (dayEnd - dayStart) * hourHeight

const { $api } = useNuxtApp()
const requestKey = computed(() => `schedule-table-${props.phaseId}`)

const { data, error, status, refresh } = await useAsyncData(
  requestKey,
  async () => {
    const [eventResult, taskResult] = await Promise.all([
      $api.api.event.get({ query: { phaseId: props.phaseId } }),
      $api.api.task.get({ query: { phaseId: props.phaseId } })
    ])

    if (eventResult.error)
      throw new Error('获取事件失败')
    if (taskResult.error)
      throw new Error('获取任务失败')
    if (!eventResult.data || !taskResult.data)
      throw new Error('日程数据为空')

    return {
      events: unwrapApiData(eventResult.data),
      tasks: unwrapApiData(taskResult.data)
    }
  },
  {
    watch: [() => props.phaseId]
  }
)

function normalizeWeeks(value: unknown) {
  if (!Array.isArray(value))
    return []
  return value.filter((week): week is number => typeof week === 'number')
}

const eventBlocks = computed(() => {
  if (!data.value)
    return []

  const taskCountByEvent = new Map<number, number>()
  for (const task of data.value.tasks) {
    if (task.eventId === null)
      continue
    taskCountByEvent.set(task.eventId, (taskCountByEvent.get(task.eventId) ?? 0) + 1)
  }

  return data.value.events.flatMap(event => event.schedules.map(schedule => ({
    renderKey: `${event.id}-${schedule.id}`,
    id: event.id,
    name: event.name,
    organizer: event.organizer,
    location: schedule.location ?? event.location,
    color: event.color,
    phaseId: event.phaseId,
    weekday: schedule.weekday,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    weeks: normalizeWeeks(schedule.weeks),
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    taskCount: taskCountByEvent.get(event.id) ?? 0
  })))
})
</script>

<template>
  <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div
      v-if="status === 'pending'"
      class="grid min-h-72 place-items-center text-sm text-slate-500"
    >
      正在加载日程…
    </div>

    <div
      v-else-if="error"
      class="grid min-h-72 place-items-center px-6 text-center"
    >
      <div>
        <p class="text-sm font-medium text-red-600">
          {{ error.message }}
        </p>
        <button
          type="button"
          class="mt-3 text-sm font-semibold text-primary-700 hover:text-primary-800"
          @click="refresh()"
        >
          重新加载
        </button>
      </div>
    </div>

    <div
      v-else-if="data"
      class="overflow-x-auto"
    >
      <div class="min-w-4xl">
        <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <p class="text-sm font-semibold text-slate-800">
            日程表
          </p>
          <p class="text-xs text-slate-500">
            {{ data.events.length }} 个事件 · {{ data.tasks.length }} 个任务
          </p>
        </div>

        <div class="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-slate-200 bg-slate-50">
          <div />
          <div
            v-for="weekday in weekdays"
            :key="weekday"
            class="border-l border-slate-200 px-2 py-3 text-center text-xs font-semibold text-slate-600"
          >
            {{ weekday }}
          </div>
        </div>

        <div class="grid grid-cols-[64px_minmax(0,1fr)]">
          <div
            class="relative border-r border-slate-200 bg-slate-50/70"
            :style="{ height: `${boardHeight}px` }"
          >
            <span
              v-for="hour in hours"
              :key="hour"
              class="absolute right-3 -translate-y-1/2 text-[11px] tabular-nums text-slate-400"
              :style="{ top: `${(hour - dayStart) * hourHeight}px` }"
            >
              {{ String(hour).padStart(2, '0') }}:00
            </span>
          </div>

          <div
            class="relative overflow-hidden"
            :style="{ height: `${boardHeight}px` }"
          >
            <div class="pointer-events-none absolute inset-0 grid grid-cols-7 divide-x divide-slate-100">
              <div
                v-for="weekday in weekdays"
                :key="weekday"
              />
            </div>
            <div
              v-for="hour in hours"
              :key="hour"
              class="pointer-events-none absolute inset-x-0 border-t border-slate-100"
              :style="{ top: `${(hour - dayStart) * hourHeight}px` }"
            />

            <EventBlock
              v-for="event in eventBlocks"
              :key="event.renderKey"
              v-bind="event"
            >
              <span class="block truncate text-sm font-semibold leading-tight text-slate-900">
                {{ event.name }}
              </span>
              <span class="mt-1 block truncate text-xs font-medium text-slate-700">
                {{ event.startTime }}–{{ event.endTime }}
              </span>
              <span
                v-if="event.taskCount"
                class="mt-1 block truncate text-xs text-slate-600"
              >
                {{ event.taskCount }} 项任务
              </span>
            </EventBlock>

            <p
              v-if="eventBlocks.length === 0"
              class="absolute inset-x-0 top-20 text-center text-sm text-slate-400"
            >
              这个阶段还没有日程
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
