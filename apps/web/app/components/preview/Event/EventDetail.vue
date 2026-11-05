// 暂时不启用
<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import EventBlock from '~/components/preview/Event/EventBlock.vue'
import { useApi } from '~/composables/useApi'
import { formatWeeksRange, parseWeeks } from '~/utils/schedule'

const EventEditPopup = defineAsyncComponent(() => import('../../edit/EventEditPopup.vue'))
const editingEventId = ref<number | null>(null)

const props = defineProps<{
  eventId: number
}>()

// 数据获取

const eventClient = useApi({
  key: () => `event:${props.eventId}`,
  read: api => api.api.event({ id: props.eventId }).get()
})
const eventClientState = useAsyncData(eventClient.key, eventClient.read, { deep: true })
const { data: event, pending: loading, refresh } = eventClientState

const tasksClient = useApi({
  key: () => `tasks:all:${props.eventId}`,
  read: api => api.api.task.get({ query: { eventId: props.eventId } })
})
const tasksClientState = useAsyncData(tasksClient.key, tasksClient.read, { deep: true })
const { data: tasks, pending: tasksLoading, refresh: refreshTasks } = tasksClientState

const schedules = computed(() => event.value?.schedules ?? [])

const showTips = ref(true)
const showTasks = ref(true)

const { now, timeZone } = useSystemTime()

const todayWeekday = computed(() =>
  now.value ? dateToWeekday(now.value, timeZone.value) : null
)

const extraLocations = computed(() => [
  ...new Set(
    schedules.value
      .map(schedule => schedule.location)
      .filter(
        (location): location is string =>
          typeof location === 'string'
          && location !== ''
          && location !== event.value?.location
      )
  )
])

// 时间表尺寸
const hourPixels = 72
const edgePixels = 10
const pixelsPerMinute = hourPixels / 60
const minBlockPixels = 70
const maxBlockPixels = 120
const maxGapMinutes = 60

function toBlockPixels(minutes: number) {
  return Math.min(
    Math.max(minutes * pixelsPerMinute, minBlockPixels),
    maxBlockPixels
  )
}

interface TimeSpan {
  start: number
  end: number
}

interface TimeCluster {
  start: number
  end: number
  spans: TimeSpan[]
}

const timeline = computed(() => {
  const scheduleSpans: TimeSpan[] = schedules.value
    .map(schedule => ({
      start: timeToMinutes(schedule.startTime),
      end: timeToMinutes(schedule.endTime)
    }))
    .sort((a, b) => a.start - b.start)

  const timeClusters: TimeCluster[] = []

  for (const span of scheduleSpans) {
    const last = timeClusters.at(-1)

    if (last && span.start <= last.end) {
      last.end = Math.max(last.end, span.end)
      last.spans.push(span)
    } else {
      timeClusters.push({ start: span.start, end: span.end, spans: [span] })
    }
  }

  // 相邻课程之间的空档超过一小时就压成一小时，避免时间表被拉得过高
  let cursor = edgePixels

  const layoutClusters = timeClusters.map((cluster, index) => {
    const top = cursor

    cursor += Math.max(
      ...cluster.spans.map(span =>
        (span.start - cluster.start) * pixelsPerMinute
        + toBlockPixels(span.end - span.start)
      )
    )

    const next = timeClusters.at(index + 1)

    if (next)
      cursor += Math.min(next.start - cluster.end, maxGapMinutes) * pixelsPerMinute

    return { start: cluster.start, end: cluster.end, top }
  })

  const boardHeight = cursor + edgePixels
  const hourMarks = layoutClusters.flatMap((cluster) => {
    const first = Math.ceil(cluster.start / 60) * 60
    const marks: number[] = []

    for (let minute = first; minute <= cluster.end; minute += 60)
      marks.push(minute)

    return marks
  })
  return { layoutClusters, boardHeight, hourMarks }
})
const boardHeight = computed(() => timeline.value.boardHeight)
const hourMarks = computed(() => timeline.value.hourMarks)
const gridColumns = `var(--time-axis-width) repeat(${weekdays.length}, minmax(0, 1fr))`

function minutesToY(minutes: number) {
  const cluster = timeline.value.layoutClusters.find(
    item => minutes >= item.start && minutes <= item.end
  )

  if (!cluster)
    return edgePixels

  return cluster.top + (minutes - cluster.start) * pixelsPerMinute
}

const scheduleBlocks = computed(() => schedules.value.map((schedule) => {
  const start = timeToMinutes(schedule.startTime)
  const end = timeToMinutes(schedule.endTime)
  const weeks = parseWeeks(schedule.weeks)

  return {
    key: `${event.value?.id}-${schedule.id}`,
    weekday: schedule.weekday,
    top: minutesToY(start),
    height: toBlockPixels(end - start),
    weeks,
    weeksLabel: formatWeeksRange(weeks),
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    location: schedule.location || event.value?.location,
    organizer: schedule.organizer || event.value?.organizer
  }
}))
</script>

<template>
  <div
    v-if="event"
    class="event-detail"
  >
    <section class="event-detail__top">
      <h2 class="event-detail__name">
        {{ event.name }}
      </h2>
      <dl class="event-detail__meta">
        <div class="event-detail__meta-item">
          <dt>地点</dt>
          <dd>
            {{ event.location || '未设置' }}
            <span
              v-if="extraLocations.length"
              class="event-detail__extra"
            >
              （{{ extraLocations.join('、') }}）
            </span>
          </dd>
        </div>
        <div class="event-detail__meta-item">
          <dt>老师</dt>
          <dd>{{ event.organizer || '未设置' }}</dd>
        </div>
      </dl>

      <h3 class="event-detail__subtitle">
        时间表（{{ schedules.length }}）
      </h3>
      <div
        v-if="schedules.length"
        class="schedule-viewport"
      >
        <section
          class="schedule"
          :style="{ '--schedule-columns': gridColumns }"
        >
          <div class="schedule-header">
            <div class="schedule-header-time" />
            <div
              v-for="(weekday, index) in weekdays"
              :key="weekday"
              class="schedule-header-weekday"
              :class="{
                'schedule-header-weekday--today': index + 1 === todayWeekday
              }"
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
                v-for="block in scheduleBlocks.filter(
                  item => item.weekday === index + 1
                )"
                :key="block.key"
                :top="block.top"
                :height="block.height"
                :color="event.color"
                :event-id="event.id"
                :event-name="block.weeksLabel"
                :start-time="block.startTime"
                :end-time="block.endTime"
                :location="block.location"
                :organizer="block.organizer"
                @edit="editingEventId = $event"
              >
                <template #title>
                  <WeekPicker
                    :model-value="block.weeks"
                  />
                </template>
              </EventBlock>
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
      <p
        v-else
        class="event-detail__empty"
      >
        暂无时间安排。
      </p>
    </section>

    <div class="event-detail__actions">
      <button
        type="button"
        @click="showTips = !showTips"
      >
        {{ showTips ? '隐藏 Tips' : '显示 Tips' }}
      </button>
      <button
        type="button"
        @click="showTasks = !showTasks"
      >
        {{ showTasks ? '隐藏 Tasks' : '显示 Tasks' }}
      </button>
    </div>

    <div class="event-detail__bottom">
      <section
        v-show="showTips"
        class="event-detail__tips"
      >
        <h3>Tips（{{ event.tips.length }}）</h3>
        <ul v-if="event.tips.length">
          <li
            v-for="tip in event.tips"
            :key="tip.id"
          >
            {{ tip.content }}
          </li>
        </ul>
        <p v-else>
          暂无提示。
        </p>
      </section>

      <section
        v-show="showTasks"
        class="event-detail__tasks"
      >
        <h3>Tasks<span v-if="tasks">（{{ tasks.length }}）</span></h3>
        <p
          v-if="tasksLoading && !tasks"
          class="muted"
          role="status"
        >
          正在加载任务……
        </p>
        <div
          v-else-if="!tasks"
          class="page-state"
        >
          <p>任务尚未载入。</p>
          <button
            class="button"
            type="button"
            @click="refreshTasks()"
          >
            重新加载
          </button>
        </div>
      </section>
    </div>
  </div>
  <p
    v-else
    class="page-state"
    role="status"
  >
    {{ loading ? '正在加载课程详情……' : '暂无课程详情。' }}
    <button
      v-if="!loading"
      class="button"
      type="button"
      @click="refresh()"
    >
      重新加载
    </button>
  </p>
  <EventEditPopup
    v-if="editingEventId !== null"
    :event-id="editingEventId"
    :open="true"
    @update:open="!$event && (editingEventId = null)"
    @saved="refresh()"
    @task-saved="refreshTasks()"
  />
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
  border: 1px solid var(--background-primary);
  background-image:
  linear-gradient(
    color-mix(in srgb, var(--background-secondary) 95%, transparent),
    color-mix(in srgb, var(--background-secondary) 15%, transparent)
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

  background-color: var(--background-secondary);
  border-bottom: 1px solid var(--background-primary);
}
.schedule-body {
  display: grid;
  grid-template-columns: var(--schedule-columns);
  position: relative;
  overflow: clip;
}

.schedule-header {
  border-bottom: 1px solid var(--background-primary);
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
  border-left: 1px solid var(--background-primary);
  position: relative;
  min-height: 44px;
  box-sizing: border-box;
  padding: 4px 4px 17px;
}
.schedule-header-weekday--today {
  color: var(--text-primary);
  background-color: var(--background-primary);
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
  border-left: 1px solid var(--background-primary);
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
  border-top: 1px solid var(--background-primary);
  pointer-events: none;
}
.event-detail {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  color: var(--text-primary);
}

.event-detail__top {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
}

.event-detail__name {
  margin: 0;
  font-size: 1.3rem;
  line-height: 1.3;
  color: var(--text-primary);
}

.event-detail__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
  margin: 0;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--background-primary);
  border-radius: 6px;
  background-color: var(--background-primary);
  font-size: 0.875rem;
}

.event-detail__meta-item {
  display: flex;
  gap: 0.5rem;
  min-width: 0;
}

.event-detail__meta-item dt {
  flex-shrink: 0;
  color: var(--text-secondary);
}

.event-detail__meta-item dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}

.event-detail__extra {
  color: var(--text-secondary);
}

.event-detail__subtitle {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.event-detail__empty {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.event-detail__actions {
  display: flex;
  gap: 0.5rem;
}

.event-detail__actions button {
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--background-primary);
  border-radius: 4px;
  background-color: var(--background-secondary);
  color: var(--text-primary);
  font: inherit;
  font-size: 0.8125rem;
  cursor: pointer;
}

.event-detail__actions button:hover {
  background-color: var(--background-primary);
}

.event-detail :deep(.week-picker) {
  --week-ball-size: 1rem;
}

.event-detail__bottom {
  display: flex;
  gap: 1rem;
}

.event-detail__tips,
.event-detail__tasks {
  flex: 1 1 0;
  min-width: 0;
  padding: 0.75rem;
  border: 1px solid var(--background-primary);
  border-radius: 6px;
  background-color: var(--background-secondary);
}

.event-detail__tips h3,
.event-detail__tasks h3 {
  margin: 0 0 0.5rem;
  font-size: 0.95rem;
  color: var(--text-primary);
}

.event-detail__tips ul,
.event-detail__tasks ul {
  margin: 0;
  padding-left: 1.25rem;
  font-size: 0.875rem;
}

.event-detail__tips p,
.event-detail__tasks p {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

@media (min-width: 1200px) {
  .event-detail {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto auto 1fr;
  }

  .event-detail__top {
    grid-area: 1 / 1 / 2 / 2;
  }

  .event-detail__actions {
    grid-area: 2 / 1 / 3 / 2;
  }

  .event-detail__bottom {
    display: contents;
  }

  .event-detail__tips {
    grid-area: 3 / 1 / 4 / 2;
  }

  .event-detail__tasks {
    grid-area: 1 / 2 / 4 / 3;
  }
}
</style>
