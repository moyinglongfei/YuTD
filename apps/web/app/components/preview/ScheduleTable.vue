<script setup lang="ts">
import { requestApiData } from '~/utils/api'
import EventBlock from '~/components/preview/Event/EventBlock.vue'
import { gsap } from 'gsap'
import Background from '../image/BackgroundLayout.vue'
import BackgroundSelect from '../image/BackgroundSelect.vue'
import type { BackgroundSelection } from '~/components/image/BackgroundSelect.vue'
import { weekdays as weekdayLabels } from '~/utils/date'

const EventEditPopup = defineAsyncComponent(() => import('../edit/EventEditPopup.vue'))
const editingEventId = ref<number | null>(null)
const creatingEvent = ref(false)
const { mode: systemMode } = useSystemStatus()
function closeEventEditor(open: boolean) {
  if (open) return
  editingEventId.value = null
  creatingEvent.value = false
}

const props = withDefaults(defineProps<{
  phaseId: number
  mode?: 'easy' | 'full' | 'custom'
  weekdays?: number[]
  showPeriodNavigation?: boolean
  backgroundKey?: string
  autoCenter?: boolean
  maxFocusScale?: number
  focusColumnScale?: number
  hourPixels?: number
  edgePixels?: number
}>(), {
  showPeriodNavigation: true,
  autoCenter: false,
  maxFocusScale: 2,
  focusColumnScale: 3,
  hourPixels: 72,
  edgePixels: 20
})

const emit = defineEmits<{
  'event-hover': [eventId: number | null]
  'task-hover': [taskId: number | null]
}>()

// 数据获取
const eventsClient = useApi({
  key: `schedule:events:${props.phaseId}`,
  read: async (api) => {
    return requestApiData(
      api.api.event.get({ query: { phaseId: props.phaseId } }),
      '获取事件失败'
    )
  }
})
const tasksClient = useApi({
  key: `schedule:tasks:${props.phaseId}`,
  read: async (api) => {
    return requestApiData(
      api.api.task.get({ query: { phaseId: props.phaseId } }),
      '获取任务失败'
    )
  }
})
const phaseClient = useApi({
  key: `schedule:phase:${props.phaseId}`,
  read: async (api) => {
    return requestApiData(
      api.api.phase({ id: props.phaseId }).get(),
      '获取阶段失败'
    )
  }
})
const [initialEvents, initialTasks, phase] = await Promise.all([
  eventsClient.read(),
  tasksClient.read(),
  phaseClient.read()
])
const events = ref(initialEvents)
const tasks = ref(initialTasks)
const { now, timeZone } = useSystemTime()

// 计算日程表的开始时间和结束时间
function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number) as [number, number]
  return hours * 60 + minutes
}
function dateToMinutes(date: Date) {
  const { hour, minute } = clockParts(date, timeZone.value)
  return hour * 60 + minute
}
function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins
    .toString()
    .padStart(2, '0')}`
}
function dateToWeekday(date: Date) {
  return calendarWeekday(calendarDate(date, timeZone.value))
}
const scheduleBounds = computed(() => {
  const startMinutes: number[] = []
  const endMinutes: number[] = []
  for (const schedule of events.value.flatMap(event => event.schedules)) {
    if (schedule.startTime && schedule.endTime) {
      startMinutes.push(timeToMinutes(schedule.startTime))
      endMinutes.push(timeToMinutes(schedule.endTime))
    }
  }
  for (const task of tasks.value) {
    if (task.dueDate) endMinutes.push(dateToMinutes(task.dueDate))
    if (task.plannedDate) startMinutes.push(dateToMinutes(task.plannedDate))
  }
  return {
    start: startMinutes.length ? Math.min(...startMinutes) : 8 * 60,
    end: endMinutes.length ? Math.max(...endMinutes) : 22 * 60
  }
})
// 今日时间超出课程范围时也保留对应的时间轴，不把标记挤到边界。
const scheduleStartMinutes = computed(() => Math.floor(Math.min(
  scheduleBounds.value.start,
  hasTodayColumn.value ? currentPosition.value!.minutes : scheduleBounds.value.start
) / 60) * 60)
const scheduleEndMinutes = computed(() => Math.ceil(Math.max(
  scheduleBounds.value.end,
  hasTodayColumn.value ? currentPosition.value!.minutes : scheduleBounds.value.end
) / 60) * 60)
const maxWeek = phase.weekCount
const phaseDay = calendarDate(phase.startDate, 'UTC')
const week = ref(1)
const dayOffset = ref(0)
function weekOf(date: string) {
  return Math.floor((calendarDayNumber(date) - calendarDayNumber(phaseDay)) / 7) + 1
}
const visibleWeekdays = computed(() => {
  const mode = props.mode ?? 'full'

  // full：始终显示全部
  if (mode === 'full') {
    return weekdayLabels.map((_, index) => index + 1)
  }

  // custom：有参数就按参数，没有就全部
  if (mode === 'custom') {
    const selected = props.weekdays
      ?.filter(day => Number.isInteger(day) && day >= 1 && day <= 7)

    return selected?.length
      ? [...new Set(selected)]
      : weekdayLabels.map((_, index) => index + 1)
  }

  // easy：整个周期内，只显示至少有一节课的周几
  const hasClass = new Set<number>()

  for (const event of events.value) {
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

  for (const task of tasks.value) {
    for (const date of [task.plannedDate, task.dueDate]) {
      if (date) {
        hasClass.add(dateToWeekday(date))
      }
    }
  }

  return weekdayLabels.map((_, index) => index + 1).filter(day => hasClass.has(day))
})
const visibleColumns = computed(() => {
  let nextWeekOffset = 0
  return visibleWeekdays.value.map((day, index, days) => {
    if (index > 0 && day < days[index - 1]!) nextWeekOffset += 7
    const date = addCalendarDays(phaseDay, (week.value - 1) * 7 + day - 1 + nextWeekOffset + dayOffset.value)
    return { key: date, date, weekday: calendarWeekday(date), week: weekOf(date) }
  })
})
const weekLabel = computed(() => [...new Set(visibleColumns.value.map(column => column.week))]
  .filter(week => week >= 1 && week <= maxWeek)
  .join(' / ') || '—')
const canMovePrevious = computed(() => props.mode === 'custom' || week.value > 1)
const canMoveNext = computed(() => props.mode === 'custom' || week.value < maxWeek)

function movePeriod(direction: -1 | 1) {
  if (direction < 0 ? !canMovePrevious.value : !canMoveNext.value) return
  if (props.mode === 'custom') {
    dayOffset.value += direction * visibleColumns.value.length
  } else {
    week.value += direction
  }
}
const hourMarks = computed(() => Array.from(
  {
    length:
      (scheduleEndMinutes.value - scheduleStartMinutes.value) / 60 + 1
  },
  (_, index: number) => scheduleStartMinutes.value + index * 60
))

// 焦点缩放
const maxFocusScale = computed(() => props.maxFocusScale)

const animatedFocusScale = reactive({
  value: props.maxFocusScale
})

watch(maxFocusScale, (value) => {
  gsap.to(animatedFocusScale, {
    value,
    duration: 0.45,
    ease: 'power4.out',
    overwrite: true
  })
}) // 垂直放大倍数
const focusColumnScale = computed(() => props.mode === 'custom' && props.weekdays?.length && props.weekdays.length <= 2
  ? 1
  : Math.min(props.focusColumnScale, Math.max(1, visibleColumns.value.length))) // 水平放大倍数
const focus = reactive({
  progress: 0,
  offsetY: 0
})
const columnWidths = ref(
  visibleColumns.value.map(() => ({ weight: 1 }))
)
watch(
  visibleColumns,
  (days) => {
    resetFocus()
    columnWidths.value = days.map(() => ({ weight: 1 }))
  }
)
const gridColumns = computed(() => {
  const columns = columnWidths.value.map((column) => {
    return `minmax(0, ${column.weight}fr)`
  })

  return `var(--time-axis-width) ${columns.join(' ')}`
})
const displayHourPixels = computed(() => {
  return hourPixels.value
    * (1 + animatedFocusScale.value * focus.progress)
})
const selectedBlockKey = ref<string | null>(null)
const focusMoving = ref(false)
let removeFocusClickListener: (() => void) | undefined

function FocusClickListener(event: MouseEvent) {
  const target = event.target

  if (target instanceof Element && target.closest('.event-block, .edit-popup, .event-edit-popup, .schedule-edit-trigger'))
    return

  closeFocus()
}

let focusTween: ReturnType<typeof gsap.to> | undefined
let columnTween: ReturnType<typeof gsap.to> | undefined

function animateColumns(columnKey: string | null) {
  columnTween?.kill()

  const count = visibleColumns.value.length

  if (count <= 1) {
    columnWidths.value.forEach((column) => {
      column.weight = columnKey === null ? 1 : focusColumnScale.value
    })
    return
  }

  const otherWeight = (count - focusColumnScale.value) / (count - 1)

  columnTween = gsap.to(columnWidths.value, {
    weight: (index: number) => {
      if (columnKey === null)
        return 1

      return visibleColumns.value[index]?.key === columnKey
        ? focusColumnScale.value
        : otherWeight
    },
    duration: 0.45,
    ease: 'power3.out'
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

  const targetHourPixels = hourPixels.value * (1 + maxFocusScale.value)
  const targetHeight = (end - start) * (targetHourPixels / 60)

  const targetCenterY = (centerMinutes - scheduleStartMinutes.value)
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

  if (!removeFocusClickListener) {
    document.addEventListener('click', FocusClickListener, true)
    removeFocusClickListener = () => {
      document.removeEventListener('click', FocusClickListener, true)
    }
  }

  selectedBlockKey.value = key
  focusMoving.value = true
  animateColumns(block.columnKey)

  focusTween = gsap.to(focus, {
    progress: 1,
    offsetY: targetOffsetY,
    duration: 0.45,
    ease: 'power3.out',
    onComplete() {
      focusMoving.value = false
    }
  })
}

function closeFocus() {
  if (selectedBlockKey.value === null)
    return

  focusTween?.kill()
  removeFocusClickListener?.()
  removeFocusClickListener = undefined
  focusMoving.value = true
  animateColumns(null)

  focusTween = gsap.to(focus, {
    progress: 0,
    offsetY: 0,
    duration: 0.45,
    ease: 'power3.out',
    onComplete() {
      focusMoving.value = false
      selectedBlockKey.value = null
    }
  })
}

async function refreshEvents() {
  try {
    const updated = await eventsClient.read()
    resetFocus()
    events.value = updated
  } catch {
    // useApi 已统一上报，保留现有课程表供重试。
  }
}
async function refreshTasks() {
  try {
    tasks.value = await tasksClient.read()
  } catch {
    // useApi 已统一上报。
  }
}

function resetFocus() {
  focusTween?.kill()
  columnTween?.kill()
  removeFocusClickListener?.()
  removeFocusClickListener = undefined
  selectedBlockKey.value = null
  focusMoving.value = false
  focus.progress = 0
  focus.offsetY = 0
  columnWidths.value.forEach((column) => {
    column.weight = 1
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
  return (minutes - scheduleStartMinutes.value)
    * (displayHourPixels.value / 60)
    + edgePixels.value
    + focus.offsetY
}
const hourPixels = computed(() => props.hourPixels)
const edgePixels = computed(() => props.edgePixels)
const boardHeight = computed(() => {
  const duration = scheduleEndMinutes.value - scheduleStartMinutes.value

  return duration * (hourPixels.value / 60)
    + edgePixels.value * 2
})
watch(
  [maxFocusScale, focusColumnScale, hourPixels, edgePixels],
  () => {
    if (selectedBlockKey.value) openFocus(selectedBlockKey.value)
  },
  { flush: 'post' }
)
const eventBlocks = computed(() =>
  visibleColumns.value.flatMap(column => events.value.flatMap(event =>
    event.schedules.flatMap((schedule) => {
      if (schedule.weekday !== column.weekday || column.week < 1 || column.week > maxWeek) return []
      const currentWeek = column.week
      if (Array.isArray(schedule.weeks)) {
        if (!schedule.weeks.includes(currentWeek)) {
          return []
        }
      }
      const start = timeToMinutes(schedule.startTime)
      const end = timeToMinutes(schedule.endTime)

      return {
        key: `${column.key}-${event.id}-${schedule.id}`,
        columnKey: column.key,
        weekday: schedule.weekday,
        color: event.color,
        top: minutesToY(start),
        height: (end - start) * (displayHourPixels.value / 60),
        eventId: event.id,
        eventName: event.name,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        location: schedule.location || event.location,
        organizer: schedule.organizer || event.organizer || null,
        tips: event.tips
      }
    })
  ))
)

interface TaskLineState {
  key: string
  task: (typeof initialTasks)[number]
  kind: 'plan' | 'due'
  minutes: number
  insideEvent: boolean
  top: Ref<number>
  covered: Ref<boolean>
  markerOffset: Ref<number>
}

const taskLines = shallowRef(new Map<string, TaskLineState[]>())

function rebuildTaskLines() {
  const columnsByDate = new Map(visibleColumns.value.map(column => [column.date, column]))
  const groups = new Map<string, TaskLineState[]>()
  const eventRanges = new Map<string, { start: number, end: number }[]>()
  for (const column of visibleColumns.value) {
    groups.set(column.key, [])
    eventRanges.set(column.key, events.value.flatMap(event => event.schedules.flatMap((schedule) => {
      if (column.week < 1 || column.week > maxWeek || schedule.weekday !== column.weekday
        || (Array.isArray(schedule.weeks) && !schedule.weeks.includes(column.week))) return []
      return { start: timeToMinutes(schedule.startTime), end: timeToMinutes(schedule.endTime) }
    })))
  }

  for (const task of tasks.value) {
    for (const kind of ['plan', 'due'] as const) {
      const date = kind === 'plan' ? task.plannedDate : task.dueDate
      if (!date) continue
      const column = columnsByDate.get(calendarDate(date, timeZone.value))
      if (!column) continue
      const minutes = dateToMinutes(date)
      const insideEvent = eventRanges.get(column.key)!.some(range => minutes >= range.start && minutes <= range.end)
      groups.get(column.key)!.push({
        key: `${task.id}-${kind}`,
        task,
        kind,
        minutes,
        insideEvent,
        top: ref(minutesToY(minutes)),
        covered: ref(insideEvent),
        markerOffset: ref(0)
      })
    }
  }
  for (const lines of groups.values()) {
    lines.sort((a, b) => b.minutes - a.minutes || a.key.localeCompare(b.key))
  }
  taskLines.value = groups
  updateTaskLineCrowding()
}

function updateTaskLinePositions() {
  const scale = displayHourPixels.value / 60
  const origin = edgePixels.value + focus.offsetY - scheduleStartMinutes.value * scale
  for (const lines of taskLines.value.values()) {
    for (const line of lines) line.top.value = origin + line.minutes * scale
  }
  updateTaskLineCrowding()
}

function updateTaskLineCrowding() {
  for (const lines of taskLines.value.values()) {
    const current = displayHourPixels.value > 0
      ? lines
      : [...lines].sort((a, b) => b.top.value - a.top.value || a.key.localeCompare(b.key))
    let markerTop = Infinity
    let markerSlot = 0
    for (const [index, line] of current.entries()) {
      const previous = current[index - 1]
      const next = current[index + 1]
      const top = line.top.value
      const crowded = (previous !== undefined && Math.abs(previous.top.value - top) < 40)
        || (next !== undefined && Math.abs(next.top.value - top) < 40)
      const covered = line.insideEvent || crowded
      if (line.covered.value !== covered) line.covered.value = covered
      if (covered) {
        markerSlot = markerTop - top < 18 ? markerSlot + 1 : 0
        markerTop = top
      }
      const offset = covered ? markerSlot * 18 : 0
      if (line.markerOffset.value !== offset) line.markerOffset.value = offset
    }
  }
}

// 实时日期定位
function getSchedulePosition(date: Date) {
  const weekNumber = weekOf(calendarDate(date, timeZone.value))

  return {
    week: weekNumber,
    weekday: dateToWeekday(date),
    minutes: dateToMinutes(date) + clockParts(date, timeZone.value).second / 60,
    inPhase: weekNumber >= 1 && weekNumber <= maxWeek
  }
}
const currentPosition = computed(() => {
  return now.value
    ? getSchedulePosition(now.value)
    : null
})
watch(
  [() => currentPosition.value?.week, () => props.mode, () => props.weekdays?.join(','), timeZone],
  ([currentWeek]) => {
    if (currentWeek === undefined) return

    week.value = props.mode === 'custom' ? currentWeek : Math.min(maxWeek, Math.max(1, currentWeek))
    dayOffset.value = 0
  },
  { immediate: true }
)
const today = computed(() => now.value ? calendarDate(now.value, timeZone.value) : null)
const hasTodayColumn = computed(() => today.value !== null
  && visibleColumns.value.some(column => column.date === today.value))
const currentTimeY = computed(() => currentPosition.value
  ? minutesToY(currentPosition.value.minutes)
  : null)
watch([tasks, events, visibleColumns, timeZone], rebuildTaskLines, { immediate: true, deep: true })
watch([displayHourPixels, scheduleStartMinutes, edgePixels, () => focus.offsetY], updateTaskLinePositions)
const viewport = ref<HTMLElement | null>(null)
const scheduleBody = ref<HTMLElement | null>(null)
const scheduleHeader = ref<HTMLElement | null>(null)

function centerCurrentTime() {
  if (!props.autoCenter || !hasTodayColumn.value || currentTimeY.value === null
    || !viewport.value || !scheduleBody.value) return

  // 首页滚动的是 PageCard；独立课程表则可能由整个页面滚动。
  let container = viewport.value.parentElement
  while (container && !/(auto|scroll|overlay)/.test(getComputedStyle(container).overflowY)) {
    container = container.parentElement
  }
  const scroller = container ?? document.scrollingElement
  if (!scroller) return

  const isDocument = scroller === document.scrollingElement
  const viewportTop = isDocument ? 0 : scroller.getBoundingClientRect().top + scroller.clientTop
  const viewportHeight = isDocument ? window.innerHeight : scroller.clientHeight
  const headerHeight = scheduleHeader.value?.offsetHeight ?? 0
  const top = scroller.scrollTop + scheduleBody.value.getBoundingClientRect().top
    - viewportTop + currentTimeY.value - (viewportHeight + headerHeight) / 2
  scroller.scrollTop = Math.max(0, Math.min(top, scroller.scrollHeight - viewportHeight))
}

// 仅进入今日视图或开启定位时居中；时钟和 focus 更新不抢走手动滚动位置。
watch(
  [() => props.autoCenter, today, timeZone, visibleColumns, viewport, scheduleBody],
  centerCurrentTime,
  { flush: 'post' }
)
const backgroundSelection = shallowRef<BackgroundSelection | null>(null)
const backgroundPending = ref(true)
const background = ref<InstanceType<typeof Background> | null>(null)
const backgroundRatio = ref<number>()
let backgroundObserver: ResizeObserver | undefined
watch(background, (component) => {
  backgroundObserver?.disconnect()
  const element = component?.$el as HTMLElement | undefined
  if (!element) return
  const resize = () => {
    if (element.clientWidth && element.clientHeight) backgroundRatio.value = element.clientWidth / element.clientHeight
  }
  resize()
  backgroundObserver = new ResizeObserver(resize)
  backgroundObserver.observe(element)
}, { flush: 'post' })
onBeforeUnmount(() => backgroundObserver?.disconnect())
</script>

<template>
  <div
    ref="viewport"
    class="schedule-viewport"
  >
    <div
      class="schedule-tools"
      :class="{ 'schedule-tools--visible': systemMode === 'edit' }"
    >
      <BackgroundSelect
        :background-key="`${backgroundKey ?? 'schedule'}:${phaseId}`"
        :aspect-ratio="backgroundRatio"
        hide-selection
        @change="backgroundSelection = $event"
        @loading-change="backgroundPending = $event"
      />
      <button
        v-if="systemMode === 'edit'"
        type="button"
        class="button"
        title="新建课程"
        aria-label="新建空白课程"
        @click="creatingEvent = true"
      >
        <Icon
          name="lucide:plus"
          aria-hidden="true"
        />
      </button>
    </div>
    <Background
      ref="background"
      class="event-schedule__background"
      :pending="backgroundPending"
      :image="backgroundSelection?.image ?? '/images/bg.png'"
      :position="backgroundSelection?.position"
      :simplified-image="backgroundSelection?.simplifiedImage"
      :analysis="backgroundSelection?.analysis"
    >
      <section
        class="schedule"
        :style="{ '--schedule-columns': gridColumns }"
      >
        <div
          ref="scheduleHeader"
          class="schedule-header"
        >
          <div class="schedule-header-time">
            {{ weekLabel }}
          </div>

          <div
            v-for="(column, index) in visibleColumns"
            :key="column.key"
            class="schedule-header-weekday"
            :class="{
              'schedule-header-weekday--today': column.date === today,
              'schedule-header-weekday--previous': showPeriodNavigation && index === 0,
              'schedule-header-weekday--next': showPeriodNavigation && index === visibleColumns.length - 1
            }"
          >
            <button
              v-if="showPeriodNavigation && index === 0"
              class="schedule-period-button schedule-period-button--previous"
              type="button"
              aria-label="上一周期"
              title="上一周期"
              :disabled="!canMovePrevious"
              @click.stop="movePeriod(-1)"
            />
            <span
              class="schedule-header-label"
              :title="weekdayLabels[column.weekday - 1]"
            >
              <span class="schedule-header-prefix">周</span>{{ weekdayLabels[column.weekday - 1]?.slice(1) }}
            </span>
            <button
              v-if="showPeriodNavigation && index === visibleColumns.length - 1"
              class="schedule-period-button schedule-period-button--next"
              type="button"
              aria-label="下一周期"
              title="下一周期"
              :disabled="!canMoveNext"
              @click.stop="movePeriod(1)"
            />
            <span class="schedule-header-date">
              {{ column.date.slice(5).replace('-', '/') }}
            </span>
          </div>
        </div>

        <div
          ref="scheduleBody"
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
            v-for="column in visibleColumns"
            :key="column.key"
            class="schedule-day-column"
          >
            <EventBlock
              v-for="block in eventBlocks.filter(
                block => block.columnKey === column.key
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
              :tips="block.tips"
              :moving="focusMoving"
              @mouseenter="emit('event-hover', block.eventId)"
              @mouseleave="emit('event-hover', null)"
              @select="openFocus(block.key)"
              @edit="editingEventId = $event"
            />
            <TaskLine
              v-for="line in taskLines.get(column.key)"
              :key="line.key"
              :top="line.top.value"
              :covered="line.covered.value"
              :marker-offset="line.markerOffset.value"
              :kind="line.kind"
              :task-id="line.task.id"
              :task="line.task"
              :task-name="line.task.title"
              :planned-date="line.kind === 'plan' ? line.task.plannedDate ?? undefined : undefined"
              :due-date="line.kind === 'due' ? line.task.dueDate ?? undefined : undefined"
              @mouseenter="emit('task-hover', line.task.id)"
              @mouseleave="emit('task-hover', null)"
            />
          </div>
          <div
            v-for="minute in hourMarks"
            :key="minute"
            class="schedule-hour-line"
            :style="{ top: `${minutesToY(minute)}px` }"
          />
          <div
            v-if="hasTodayColumn && currentTimeY !== null"
            class="schedule-current-time"
            :style="{ top: `${currentTimeY}px` }"
            aria-hidden="true"
          >
            <span
              v-for="(column, index) in visibleColumns"
              :key="column.key"
              class="schedule-current-time__line"
              :class="{ 'schedule-current-time__line--today': column.date === today }"
              :style="{ gridColumn: index + 2 }"
            />
          </div>
        </div>
      </section>
    </Background>
    <EventEditPopup
      v-if="editingEventId !== null || creatingEvent"
      :event-id="editingEventId ?? undefined"
      :phase-id="phaseId"
      :week-count="maxWeek"
      :open="true"
      @update:open="closeEventEditor"
      @saved="refreshEvents"
      @task-saved="refreshTasks"
    />
  </div>
</template>

<style scoped>
.schedule-tools { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.schedule-tools--visible { margin-bottom: 8px; }
.schedule-viewport {
  width: 100%;
  min-width: 0;
  container-type: inline-size;
  container-name: schedule;
  overflow: visible;
}

.schedule-viewport > .event-schedule__background {
  height: auto;
  overflow: clip;
}

.schedule {
  --time-axis-width: 64px;

  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid var(--border-color);
}

.hour-short {
  display: none;
}
@container schedule (max-width: 600px) {
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

  color: var(--text-primary);
  background-color: var(--background-secondary);
  border-bottom: 1px solid var(--border-color);
}
.schedule-body {
  display: grid;
  grid-template-columns: var(--schedule-columns);
  position: relative;
  overflow: clip;
}

.schedule-header-time {
  display: grid;
  place-items: center;
  background-color: var(--background-primary);
}

.schedule-header-weekday {
  min-width: 0;
  container-type: inline-size;
  container-name: schedule-weekday;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  border-left: 1px solid var(--border-color);
  position: relative;
  min-height: 44px;
  box-sizing: border-box;
  padding: 4px 4px 17px;
}
.schedule-header-weekday--today {
  color: var(--text-primary);
  background-color: color-mix(in srgb, var(--text-secondary) 16%, var(--background-secondary));
  box-shadow: inset 0 -2px 0 var(--text-secondary);
  font-weight: 700;
}
.schedule-header-weekday--previous { padding-left: 22px; }
.schedule-header-weekday--next { padding-right: 22px; }

.schedule-header-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

@container schedule-weekday (width < 2.25em) {
  .schedule-header-prefix { display: none; }
}

.schedule-period-button {
  position: absolute;
  top: 4px;
  display: grid;
  place-items: center;
  width: 20px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}

.schedule-period-button::before {
  width: 8px;
  height: 12px;
  background: currentColor;
  content: '';
}

.schedule-period-button--previous { left: 1px; }
.schedule-period-button--next { right: 1px; }
.schedule-period-button--previous::before { clip-path: polygon(100% 0, 0 50%, 100% 100%); }
.schedule-period-button--next::before { clip-path: polygon(0 0, 100% 50%, 0 100%); }

.schedule-period-button:hover:not(:disabled) {
  color: var(--text-primary);
  background: var(--background-primary);
}

.schedule-period-button:disabled {
  opacity: .3;
  cursor: default;
}

.schedule-header-date {
  position: absolute;
  left: 4px;
  bottom: 3px;
  font-size: 10px;
  line-height: 1;
  font-weight: 400;
  color: var(--text-secondary);
}

.schedule-time-axis {
  position: relative;
  overflow: hidden;
  color: var(--text-secondary);
  background-color: var(--background-secondary);
}
.schedule-day-column {
  position: relative;
  min-width: 0;
  border-left: 1px solid var(--border-color);
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
  border-top: 1px solid color-mix(in srgb, var(--text-secondary) 24%, transparent);
  pointer-events: none;
}

.schedule-current-time {
  position: absolute;
  display: grid;
  grid-template-columns: var(--schedule-columns);
  left: 0;
  right: 0;
  height: 0;
  z-index: 12;
  color: var(--accent-color);
  pointer-events: none;
}

.schedule-current-time::before {
  position: absolute;
  left: calc(var(--time-axis-width) - 8px);
  top: -6px;
  width: 8px;
  height: 12px;
  background: currentColor;
  clip-path: polygon(0 0, 100% 50%, 0 100%);
  content: '';
}

.schedule-current-time__line {
  grid-row: 1;
  height: 0;
  border-top: 2px dashed currentColor;
  transform: translateY(-1px);
  opacity: .25;
}

.schedule-current-time__line--today {
  opacity: 1;
}
</style>
