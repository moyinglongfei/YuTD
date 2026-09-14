<script setup lang="ts">
import { requestApiData } from '~/utils/api'
import EventBlock from '~/components/EventBlock.vue'
import { gsap } from 'gsap'

const props = defineProps<{
  phaseId: number
}>()

// 数据获取
const { $api } = useNuxtApp()

const [events, tasks, phase] = await Promise.all([
  requestApiData(
    $api.api.event.get({ query: { phaseId: props.phaseId } }),
    '获取事件失败'
  ),
  requestApiData(
    $api.api.task.get({ query: { phaseId: props.phaseId } }),
    '获取任务失败'
  ),
  requestApiData(
    $api.api.phase({ id: props.phaseId }).get(),
    '获取阶段失败'
  )
])

// 计算日程表的开始时间和结束时间
function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number) as [number, number]
  return hours * 60 + minutes
}
function dateToMinutes(date: Date) {
  const d = new Date(date)
  return d.getHours() * 60 + d.getMinutes()
}
function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins
    .toString()
    .padStart(2, '0')}`
}
function dateToWeekday(date: Date) {
  const d = new Date(date)
  return d.getDay() === 0 ? 7 : d.getDay()
}
const schedules = events.flatMap(event => event.schedules)
const dueTimes = tasks.flatMap(task => task.dueDate)
const plannedTimes = tasks.flatMap(task => task.plannedDate)
const startMinutes: number[] = []
const endMinutes: number[] = []
for (const schedule of schedules) {
  if (schedule.startTime && schedule.endTime) {
    startMinutes.push(timeToMinutes(schedule.startTime))
    endMinutes.push(timeToMinutes(schedule.endTime))
  }
}
for (const dueTime of dueTimes) {
  if (dueTime) {
    endMinutes.push(dateToMinutes(dueTime))
  }
}
for (const plannedTime of plannedTimes) {
  if (plannedTime) {
    startMinutes.push(dateToMinutes(plannedTime))
  }
}
const miniStartMinutes = startMinutes.length ? Math.min(...startMinutes) : 8 * 60
const maxEndMinutes = endMinutes.length ? Math.max(...endMinutes) : 22 * 60
const scheduleStartMinutes = Math.floor(miniStartMinutes / 60) * 60
const scheduleEndMinutes = Math.ceil(maxEndMinutes / 60) * 60
const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const maxWeek = phase.weekCount
const hourMarks = Array.from(
  {
    length:
      (scheduleEndMinutes - scheduleStartMinutes) / 60 + 1
  },
  (_, index: number) => scheduleStartMinutes + index * 60
)

// 焦点缩放
const focus = reactive({
  progress: 0
})
const displayHourPixels = computed(() => {
  return hourPixels.value * (1 + 2 * focus.progress)
})
const selectedBlockKey = ref<string | null>(null)
const viewport = ref<HTMLDivElement | null>(null)
let focusTween: ReturnType<typeof gsap.to> | undefined
let focusElement: HTMLElement | null = null
let anchorY = 0
function rememberCenter(element: HTMLElement) {
  const container = viewport.value

  if (!container)
    return

  focusElement = element

  const cardRect = element.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()

  anchorY = cardRect.top
    + cardRect.height / 2
    - containerRect.top
}
function keepCenter() {
  const container = viewport.value
  const element = focusElement

  if (!container || !element || !element.isConnected)
    return

  const cardRect = element.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()

  const currentY = cardRect.top
    + cardRect.height / 2
    - containerRect.top

  container.scrollTop += currentY - anchorY
}
watch(
  () => focus.progress,
  keepCenter,
  { flush: 'post' }
)// 监视焦点缩放进度，保持选中元素居中

function openFocus(key: string, element: HTMLElement) {
  focusTween?.kill()

  rememberCenter(element)
  selectedBlockKey.value = key

  focusTween = gsap.to(focus, {
    progress: 1,
    duration: 0.35,
    ease: 'power2.inOut'
  })
}

function closeFocus() {
  if (selectedBlockKey.value === null)
    return

  focusTween?.kill()

  if (focusElement)
    rememberCenter(focusElement)

  focusTween = gsap.to(focus, {
    progress: 0,
    duration: 0.35,
    ease: 'power2.inOut',
    onComplete() {
      selectedBlockKey.value = null
    }
  })
}

onBeforeUnmount(() => {
  focusTween?.kill()
})

// 呈现事件，任务组件
function minutesToY(minutes: number) {
  return (minutes - scheduleStartMinutes)
    * (displayHourPixels.value / 60)
    + edgePixels.value
}
const week = ref(1)
const hourPixels = ref(72)
const edgePixels = ref(10)
const boardHeight = computed(() => minutesToY(scheduleEndMinutes) + edgePixels.value)

const eventBlocks = computed(() =>
  events.flatMap(event =>
    event.schedules.flatMap((schedule) => {
      const currentWeek = Number(week.value)
      if (Array.isArray(schedule.weeks)) {
        if (!schedule.weeks.includes(currentWeek)) {
          return []
        }
      }
      const start = timeToMinutes(schedule.startTime)
      const end = timeToMinutes(schedule.endTime)

      return {
        key: `${event.id}-${schedule.id}`,
        weekday: schedule.weekday,
        color: event.color,
        top: minutesToY(start),
        height: (end - start) * (displayHourPixels.value / 60),
        eventId: event.id,
        eventName: event.name,
        startTime: schedule.startTime,
        endTime: schedule.endTime
      }
    })
  )
)

function isDateInWeek(date: Date, week: number) {
  if (!date) return false
  const d = new Date(date)
  const weekStart = new Date(phase.startDate)
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(weekStart.getDate() + (week - 1) * 7)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  return d >= weekStart && d < weekEnd
}
const taskLines = computed(() => {
  const lines: Array<{
    key: string
    taskId: number
    weekday: number
    taskName?: string
    kind: 'plan' | 'due'
    top: number
  }> = []

  for (const task of tasks) {
    if (task.plannedDate && isDateInWeek(task.plannedDate, week.value)) {
      lines.push({
        key: `${task.id}-plan`,
        taskId: task.id,
        weekday: dateToWeekday(task.plannedDate),
        kind: 'plan',
        taskName: task.title,
        top: minutesToY(
          dateToMinutes(task.plannedDate)
        )
      })
    }

    if (task.dueDate && isDateInWeek(task.dueDate, week.value)) {
      lines.push({
        key: `${task.id}-due`,
        taskId: task.id,
        weekday: dateToWeekday(task.dueDate),
        taskName: task.title,
        kind: 'due',
        top: minutesToY(
          dateToMinutes(task.dueDate)
        )
      })
    }
  }

  return lines
})
</script>

<template>
  <USlider
    v-model="week"
    :min="1"
    :max="maxWeek"
    :step="1"
    :label="`Weekday: ${week}`"
    :disabled="selectedBlockKey !== null"
  />
  <p>{{ week }}</p>
  <USlider
    v-model="hourPixels"
    :min="12"
    :max="91"
    :step="1"
    :label="`${hourPixels}px`"
    :disabled="selectedBlockKey !== null"
  />
  <p>{{ hourPixels }}</p>
  <div
    ref="viewport"
    class="schedule-viewport"
    @click="closeFocus"
  >
    <section class="schedule">
      <div class="schedule-header">
        <div class="schedule-header-time">
          时间
        </div>

        <div
          v-for="weekday in weekdays"
          :key="weekday"
          class="schedule-header-weekday"
        >
          {{ weekday }}
        </div>
      </div>

      <div
        class="schedule-body"
        :style="{ height: `${boardHeight}px` }"
      >
        <div class="schedule-time-axis">
          <span
            v-for="minute in hourMarks"
            :key="minute"
            class="schedule-hour-label"
            :style="{ top: `${minutesToY(minute)}px` }"
          >
            {{ minutesToTime(minute) }}
          </span>
        </div>
        <div
          v-for="(weekday, index) in weekdays"
          :key="weekday"
          class="schedule-day-column"
        >
          <EventBlock
            v-for="block in eventBlocks.filter(
              block => block.weekday === index + 1
            )"
            :key="block.key"
            :top="block.top"
            :height="block.height"
            :color="block.color"
            :event-id="block.eventId"
            :event-name="block.eventName"
            :start-time="block.startTime"
            :end-time="block.endTime"
            :focused="selectedBlockKey === block.key"
            @select="openFocus(block.key, $event)"
          />
          <TaskLine
            v-for="line in taskLines.filter(
              line => line.weekday === index + 1
            )"
            :key="line.key"
            :top="line.top"
            :kind="line.kind"
            :task-id="line.taskId"
            :task-name="line.taskName"
          />
        </div>
        <div
          v-for="minute in hourMarks"
          :key="minute"
          class="schedule-hour-line"
          :style="{ top: `${minutesToY(minute)}px` }"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.schedule-viewport {
  height: 70vh;
  overflow: auto;
  overflow-anchor: none;
  scroll-behavior: auto;
}

.schedule {
  min-width: 904px;
  border: 1px solid #2a56af;
}

.schedule-header,
.schedule-body {
  display: grid;
  grid-template-columns: 64px repeat(7, minmax(120px, 1fr));
}

.schedule-header {
  border-bottom: 1px solid #2a56af;
}

.schedule-body {
  position: relative;
}

.schedule-header-weekday {
  display: flex;
  align-items: center;
  justify-content: center;
  border-left: 1px solid #2a56af;
}

.schedule-time-axis {
  position: relative;
  overflow: hidden;
}
.schedule-day-column {
  position: relative;
  border-left: 1px solid #2a56af;
}

.schedule-hour-label {
  position: absolute;
  right: 8px;
  transform: translateY(-50%);
}

.schedule-hour-line {
  position: absolute;
  right: 0;
  left: 64px;
  border-top: 1px solid #dbe4f4;
  pointer-events: none;
}
</style>
