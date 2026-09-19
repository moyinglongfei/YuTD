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
const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const maxWeek = phase.weekCount
const hourMarks = Array.from(
  {
    length:
      (scheduleEndMinutes - scheduleStartMinutes) / 60 + 1
  },
  (_, index: number) => scheduleStartMinutes + index * 60
)

// 焦点缩放
const maxFocusScale = 2 // 垂直放大倍数
const focusColumnScale = 3 // 水平放大倍数
const focus = reactive({
  progress: 0,
  offsetY: 0
})
const columnWidths = reactive(
  weekdays.map(() => ({ weight: 1 }))
)
const gridColumns = computed(() => {
  const columns = columnWidths.map((column) => {
    return `minmax(0, ${column.weight}fr)`
  })

  return `var(--time-axis-width) ${columns.join(' ')}`
})
const displayHourPixels = computed(() => {
  return hourPixels.value * (1 + maxFocusScale * focus.progress)
})
const selectedBlockKey = ref<string | null>(null)

let focusTween: ReturnType<typeof gsap.to> | undefined
let columnTween: ReturnType<typeof gsap.to> | undefined

function animateColumns(weekday: number | null) {
  columnTween?.kill()

  const otherWeight = (weekdays.length - focusColumnScale)
    / (weekdays.length - 1)

  columnTween = gsap.to(columnWidths, {
    weight: (index: number) => {
      if (weekday === null)
        return 1

      return index + 1 === weekday
        ? focusColumnScale
        : otherWeight
    },
    duration: 0.35,
    ease: 'power2.inOut'
  })
}

function openFocus(key: string) {
  const block = eventBlocks.value.find(block => block.key === key)

  if (!block)
    return

  focusTween?.kill()

  const start = timeToMinutes(block.startTime)
  const end = timeToMinutes(block.endTime)
  const centerMinutes = (start + end) / 2

  const currentCenterY = minutesToY(centerMinutes)

  const targetHourPixels = hourPixels.value * (1 + maxFocusScale)
  const targetHeight = (end - start) * (targetHourPixels / 60)

  const targetCenterY = (centerMinutes - scheduleStartMinutes)
    * (targetHourPixels / 60)
    + edgePixels.value

  // 先算出保持原中心所需的偏移。
  let targetOffsetY = currentCenterY - targetCenterY

  const desiredTop = currentCenterY - targetHeight / 2
  const desiredBottom = currentCenterY + targetHeight / 2

  const minTop = edgePixels.value
  const maxBottom = boardHeight.value - edgePixels.value

  // 越过上边界就往下挪，越过下边界就往上挪。
  if (desiredTop < minTop) {
    targetOffsetY += minTop - desiredTop
  } else if (desiredBottom > maxBottom) {
    targetOffsetY -= desiredBottom - maxBottom
  }

  selectedBlockKey.value = key
  animateColumns(block.weekday)

  focusTween = gsap.to(focus, {
    progress: 1,
    offsetY: targetOffsetY,
    duration: 0.35,
    ease: 'power2.inOut'
  })
}

function closeFocus() {
  if (selectedBlockKey.value === null)
    return

  focusTween?.kill()
  animateColumns(null)

  focusTween = gsap.to(focus, {
    progress: 0,
    offsetY: 0,
    duration: 0.35,
    ease: 'power2.inOut',
    onComplete() {
      selectedBlockKey.value = null
    }
  })
}

onBeforeUnmount(() => {
  focusTween?.kill()
  columnTween?.kill()
})

// 呈现事件，任务组件
function minutesToY(minutes: number) {
  return (minutes - scheduleStartMinutes)
    * (displayHourPixels.value / 60)
    + edgePixels.value
    + focus.offsetY
}
const week = ref(1)
const hourPixels = ref(72)
const edgePixels = ref(10)
const boardHeight = computed(() => {
  const duration = scheduleEndMinutes - scheduleStartMinutes

  return duration * (hourPixels.value / 60)
    + edgePixels.value * 2
})
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
        endTime: schedule.endTime,
        location: schedule.location || event.location,
        organizer: event.organizer ?? null
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
const taskLines = computed(() =>
  tasks.flatMap((task) => {
    const currentWeek = Number(week.value)

    const plannedLines
      = task.plannedDate && isDateInWeek(task.plannedDate, currentWeek)
        ? [{
            key: `${task.id}-plan`,
            taskId: task.id,
            weekday: dateToWeekday(task.plannedDate),
            taskName: task.title,
            kind: 'plan' as const,
            plannedDate: task.plannedDate,
            dueDate: undefined,
            top: minutesToY(dateToMinutes(task.plannedDate))
          }]
        : []

    const dueLines
      = task.dueDate && isDateInWeek(task.dueDate, currentWeek)
        ? [{
            key: `${task.id}-due`,
            taskId: task.id,
            weekday: dateToWeekday(task.dueDate),
            taskName: task.title,
            kind: 'due' as const,
            plannedDate: undefined,
            dueDate: task.dueDate,
            top: minutesToY(dateToMinutes(task.dueDate))
          }]
        : []

    return [...plannedLines, ...dueLines]
  })
)
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
    class="schedule-viewport"
    @click="closeFocus"
  >
    <section
      class="schedule"
      :style="{ '--schedule-columns': gridColumns }"
    >
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
            <span class="hour-full">
              {{ minutesToTime(minute) }}
            </span>
            <span class="hour-short">
              {{ minutesToTime(minute).split(':')[0] }}
            </span>
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
            :location="block.location"
            :organizer="block.organizer"
            :focused="selectedBlockKey === block.key"
            :focus-progress="focus.progress"
            @select="openFocus(block.key)"
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
            :planned-date="line.plannedDate"
            :due-date="line.dueDate"
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
  width: 100%;
  min-width: 0;
  container-type: inline-size;
  container-name: schedule;
  overflow: visible;
}

.schedule {
  --time-axis-width: 64px;

  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid #2a56af;
  background-image:
  linear-gradient(
    rgba(255, 255, 255, 0.95),
    rgba(255, 255, 255, 0.15)
  ),
  url('/images/bg.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.hour-short {
  display: none;
}
@container schedule (max-width: 400px) {
  .hour-full {
    display: none;
  }

  .hour-short {
    display: inline;
    font-size: 13px;
  }
  .schedule-header-time {
    font-size: 10px;
  }
  .schedule-time-axis {
    text-align: center;
  }

  .schedule {
    --time-axis-width: 16px;
  }
}

.schedule-header {
  display: grid;
  grid-template-columns: var(--schedule-columns);
  position: sticky;
  top: 0;
  z-index: 20;

  background-color: #fff;
  border-bottom: 1px solid #2a56af;
}
.schedule-body {
  display: grid;
  grid-template-columns: var(--schedule-columns);
  position: relative;
  overflow: clip;
}

.schedule-header {
  border-bottom: 1px solid #2a56af;
}
.schedule-header-time {
  text-align: center;
}

.schedule-body {
  position: relative;
}

.schedule-header-weekday {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  border-left: 1px solid #2a56af;
}

.schedule-time-axis {
  position: relative;
  overflow: hidden;
}
.schedule-day-column {
  position: relative;
  min-width: 0;
  border-left: 1px solid #2a56af;
  container-type: inline-size;
  container-name: schedule-day;
}

.schedule-hour-label {
  position: absolute;
  left: 0;
  right: 0;
  text-align: center;
  transform: translateY(-50%);
}

.schedule-hour-line {
  position: absolute;
  right: 0;
  left: var(--time-axis-width);
  border-top: 1px solid #dbe4f4;
  pointer-events: none;
}
</style>
