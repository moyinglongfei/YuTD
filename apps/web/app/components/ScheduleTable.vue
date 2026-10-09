<script setup lang="ts">
import { requestApiData } from '~/utils/api'
import EventBlock from '~/components/EventBlock.vue'
import { gsap } from 'gsap'

const props = defineProps<{
  phaseId: number
  mode?: 'easy' | 'full' | 'custom'
  customWeekdays?: number[]
}>()

const emit = defineEmits<{
  'event-hover': [eventId: number | null]
  'task-hover': [taskId: number | null]
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
const { now } = useSystemTime()

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
const maxWeek = phase.weekCount
const visibleWeekdays = computed(() => {
  const mode = props.mode ?? 'full'

  // full：始终显示全部
  if (mode === 'full') {
    return [...weekdays]
  }

  // custom：有参数就按参数，没有就全部
  if (mode === 'custom') {
    const selected = props.customWeekdays
      ?.filter(day => Number.isInteger(day) && day >= 1 && day <= 7)

    return selected?.length
      ? weekdays.filter(day => selected.includes(weekdays.indexOf(day) + 1))
      : [...weekdays]
  }

  // easy：整个周期内，只显示至少有一节课的周几
  const hasClass = new Set<number>()

  for (const event of events) {
    for (const schedule of event.schedules) {
      const weekday = schedule.weekday

      if (!weekday || weekday < 1 || weekday > 7) {
        continue
      }

      if (!Array.isArray(schedule.weeks)) {
        continue
      }

      // 只要这个课程在 phase 的任意一周出现，就保留这个周几
      if (schedule.weeks.some(week => week != null && Number(week) >= 1 && Number(week) <= maxWeek)) {
        hasClass.add(weekday)
      }
    }
  }

  for (const task of tasks) {
    for (const date of [task.plannedDate, task.dueDate]) {
      if (date) {
        hasClass.add(dateToWeekday(date))
      }
    }
  }

  return weekdays.filter((_, index) => hasClass.has(index + 1))
})
const hourMarks = Array.from(
  {
    length:
      (scheduleEndMinutes - scheduleStartMinutes) / 60 + 1
  },
  (_, index: number) => scheduleStartMinutes + index * 60
)

// 焦点缩放
const maxFocusScale = 2 // 垂直放大倍数
let focusColumnScale = 3 // 水平放大倍数
if (props.mode === 'custom' && props.customWeekdays?.length && props.customWeekdays?.length <= 2) {
  focusColumnScale = 1
}
const focus = reactive({
  progress: 0,
  offsetY: 0
})
const columnWidths = ref(
  visibleWeekdays.value.map(() => ({ weight: 1 }))
)
watch(
  visibleWeekdays,
  (days) => {
    columnWidths.value = days.map(() => ({ weight: 1 }))
  },
  { immediate: true }
)
const gridColumns = computed(() => {
  const columns = columnWidths.value.map((column) => {
    return `minmax(0, ${column.weight}fr)`
  })

  return `var(--time-axis-width) ${columns.join(' ')}`
})
const displayHourPixels = computed(() => {
  return hourPixels.value * (1 + maxFocusScale * focus.progress)
})
const selectedBlockKey = ref<string | null>(null)
let removeFocusClickListener: (() => void) | undefined

function FocusClickListener(event: MouseEvent) {
  const target = event.target

  if (target instanceof Element && target.closest('.event-block'))
    return

  closeFocus()
}

let focusTween: ReturnType<typeof gsap.to> | undefined
let columnTween: ReturnType<typeof gsap.to> | undefined

function animateColumns(weekday: number | null) {
  columnTween?.kill()

  const count = visibleWeekdays.value.length

  if (count <= 1) {
    columnWidths.value.forEach((column) => {
      column.weight = weekday === null ? 1 : focusColumnScale
    })
    return
  }

  const otherWeight = (count - focusColumnScale) / (count - 1)

  columnTween = gsap.to(columnWidths.value, {
    weight: (index: number) => {
      if (weekday === null)
        return 1

      return index === weekday - 1
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

  if (selectedBlockKey.value === null) {
    document.addEventListener('click', FocusClickListener, true)
    removeFocusClickListener = () => {
      document.removeEventListener('click', FocusClickListener, true)
    }
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
  removeFocusClickListener?.()
  removeFocusClickListener = undefined
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
  removeFocusClickListener?.()
  removeFocusClickListener = undefined
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
function getWeekdayDate(weekNumber: number, weekday: number) {
  const date = new Date(phase.startDate)

  date.setUTCDate(
    date.getUTCDate() + (weekNumber - 1) * 7 + (weekday - 1)
  )

  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`
}
const week = ref(1)
const hourPixels = ref(72)
const edgePixels = ref(20)
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

// 实时日期定位
function getSchedulePosition(date: Date) {
  const phaseStart = new Date(phase.startDate)

  const startDay = Date.UTC(
    phaseStart.getUTCFullYear(),
    phaseStart.getUTCMonth(),
    phaseStart.getUTCDate()
  )

  const targetDay = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  )

  const days = (targetDay - startDay) / 86_400_000
  const weekNumber = Math.floor(days / 7) + 1

  return {
    week: weekNumber,
    weekday: dateToWeekday(date),
    minutes: dateToMinutes(date),
    inPhase: weekNumber >= 1 && weekNumber <= maxWeek
  }
}
const currentPosition = computed(() => {
  return now.value
    ? getSchedulePosition(now.value)
    : null
})
let initialWeekSelected = false

watch(
  () => currentPosition.value?.week,
  (currentWeek) => {
    if (currentWeek === undefined || initialWeekSelected) return

    week.value = Math.min(maxWeek, Math.max(1, currentWeek))
    initialWeekSelected = true
  },
  { immediate: true }
)
const todayWeekday = computed(() => {
  const position = currentPosition.value

  if (!position?.inPhase) return null
  if (position.week !== Number(week.value)) return null

  return position.weekday
})
</script>

<template>
  <div
    class="schedule-viewport"
  >
    <section
      class="schedule"
      :style="{ '--schedule-columns': gridColumns }"
    >
      <div class="schedule-header">
        <div class="schedule-header-time">
          {{ week }}
        </div>

        <div
          v-for="weekday in visibleWeekdays"
          :key="weekday"
          class="schedule-header-weekday"
          :class="{
            'schedule-header-weekday--today': weekdays.indexOf(weekday) + 1 === todayWeekday
          }"
        >
          {{ weekday }}
          <span class="schedule-header-date">
            {{ getWeekdayDate(week, weekdays.indexOf(weekday) + 1) }}
          </span>
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
          v-for="weekday in visibleWeekdays"
          :key="weekday"
          class="schedule-day-column"
        >
          <EventBlock
            v-for="block in eventBlocks.filter(
              block => block.weekday === weekdays.indexOf(weekday) + 1
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
            @mouseenter="emit('event-hover', block.eventId)"
            @mouseleave="emit('event-hover', null)"
            @select="openFocus(block.key)"
          />
          <TaskLine
            v-for="line in taskLines.filter(
              line => line.weekday === weekdays.indexOf(weekday) + 1
            )"
            :key="line.key"
            :top="line.top"
            :kind="line.kind"
            :task-id="line.taskId"
            :task-name="line.taskName"
            :planned-date="line.plannedDate"
            :due-date="line.dueDate"
            @mouseenter="emit('task-hover', line.taskId)"
            @mouseleave="emit('task-hover', null)"
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
  display: grid;
  place-items: center;
}

.schedule-body {
  position: relative;
}

.schedule-header-weekday {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  border-left: 1px solid #2a56af;
  position: relative;
  min-height: 44px;
  box-sizing: border-box;
  padding: 4px 4px 17px;
}
.schedule-header-weekday--today {
  color: #dc2626;
  background-color: #fef2f2;
  font-weight: 700;
}
.schedule-header-date {
  position: absolute;
  left: 4px;
  bottom: 3px;
  font-size: 10px;
  line-height: 1;
  font-weight: 400;
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
