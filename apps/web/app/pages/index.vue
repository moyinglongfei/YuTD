<script setup lang="ts">
import EventDetail from '~/components/EventDetail.vue'
import TaskPreview from '~/components/preview/TaskPreview.vue'
import { requestApiData } from '~/utils/api'
import { useRead } from '~/composables/useRead'

const { $api } = useNuxtApp()
const selectedPhaseId = useState<number | null>('selectedPhaseId', () => null)
const { now } = useSystemTime()

const { data: phase, loading, readError, refresh } = useRead(
  () => `phase:${selectedPhaseId.value ?? 'none'}`,
  async () => {
    if (selectedPhaseId.value === null)
      return null

    return requestApiData(
      $api.api.phase({ id: selectedPhaseId.value }).get(),
      '获取阶段失败'
    )
  }
)

const { data: events } = useRead(
  () => `events:${selectedPhaseId.value ?? 'none'}`,
  async () => {
    if (selectedPhaseId.value === null)
      return []

    return requestApiData(
      $api.api.event.get({ query: { phaseId: selectedPhaseId.value } }),
      '获取课程失败'
    )
  }
)

function getWeekday(date: Date) {
  return date.getDay() === 0 ? 7 : date.getDay()
}

const customWeekdays = computed(() => {
  const current = now.value ?? new Date()
  const tomorrow = new Date(current)
  tomorrow.setDate(tomorrow.getDate() + 1)

  return [getWeekday(current), getWeekday(tomorrow)]
})

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number) as [number, number]
  return hours * 60 + minutes
}

function getOccurrenceDate(startDate: Date | string, week: number, weekday: number, time: string) {
  const start = new Date(startDate)
  const [hours, minutes] = time.split(':').map(Number) as [number, number]
  const date = new Date(Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate() + (week - 1) * 7 + (weekday - 1),
    hours,
    minutes
  ))

  return new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes()
  )
}

const nearestEventId = computed(() => {
  const current = now.value ?? new Date()
  if (!phase.value || !events.value?.length)
    return null

  const candidates = events.value.flatMap(event =>
    event.schedules.flatMap((schedule) => {
      const weeks = Array.isArray(schedule.weeks)
        ? schedule.weeks.filter(week => Number.isInteger(Number(week)))
        : Array.from(
            { length: phase.value?.weekCount ?? 0 },
            (_, index) => index + 1
          )

      return weeks.map((week) => {
        const start = getOccurrenceDate(
          phase.value!.startDate,
          Number(week),
          schedule.weekday,
          schedule.startTime
        )
        const end = new Date(start)
        end.setMinutes(end.getMinutes() + timeToMinutes(schedule.endTime) - timeToMinutes(schedule.startTime))

        return {
          eventId: event.id,
          start,
          end
        }
      })
    })
  )

  if (!candidates.length)
    return null

  const upcoming = candidates.filter(candidate => candidate.end.getTime() >= current.getTime())
  const pool = upcoming.length ? upcoming : candidates
  const nearest = pool.reduce((previous, currentCandidate) => {
    const previousDistance = Math.abs(previous.start.getTime() - current.getTime())
    const currentDistance = Math.abs(currentCandidate.start.getTime() - current.getTime())

    return currentDistance < previousDistance ? currentCandidate : previous
  })

  return nearest.eventId
})
function EventHover(id: number | null) {
  if (id !== null) {
    const event = events.value?.find(e => e.id === id)
    if (event) {
      console.log(`Hovered Event: ${event.name} (ID: ${event.id})`)
    }
  } else {
    console.log('No event hovered')
  }
}
function TaskHover(id: number | null) {
  if (id !== null) {
    console.log(`Hovered Task ID: ${id}`)
  } else {
    console.log('No task hovered')
  }
}
</script>

<template>
  <main class="home-page">
    <div
      v-if="readError"
      class="home-page__state home-page__state--error"
    >
      <p>{{ readError }}</p>
      <button
        type="button"
        :disabled="loading"
        @click="refresh()"
      >
        {{ loading ? '重试中……' : '重试' }}
      </button>
    </div>
    <p
      v-else-if="loading"
      class="home-page__state"
      role="status"
    >
      正在加载阶段……
    </p>
    <p
      v-else-if="selectedPhaseId === null"
      class="home-page__state"
    >
      请先在边栏选择一个 Phase 喵。
    </p>
    <div
      v-else-if="phase && phase.id === selectedPhaseId"
      class="home-page__layout"
    >
      <div class="home-page__upper">
        <section class="home-page__panel home-page__schedule">
          <ScheduleTable
            :key="phase.id"
            :phase-id="phase.id"
            mode="custom"
            :custom-weekdays="customWeekdays"
            @event-hover="EventHover($event)"
            @task-hover="TaskHover($event)"
          />
        </section>
        <section class="home-page__panel home-page__tasks">
          <TaskPreview :phase-id="phase.id" />
        </section>
      </div>
      <section class="home-page__panel home-page__detail">
        <EventDetail
          v-if="nearestEventId !== null"
          :key="nearestEventId"
          :event-id="nearestEventId"
        />
        <p
          v-else
          class="home-page__empty"
        >
          暂无最近课程。
        </p>
      </section>
    </div>
  </main>
</template>

<style scoped>
.home-page {
  min-height: 100dvh;
  padding: var(--page-gutter);
}

.home-page__layout {
  display: grid;
  grid-template-rows: 7fr 3fr;
  gap: var(--page-gutter);
  min-height: calc(100dvh - var(--page-gutter) * 2);
}

.home-page__upper {
  display: grid;
  grid-template-columns: 5fr 5fr;
  gap: var(--page-gutter);
  min-height: 0;
}

.home-page__panel {
  min-width: 0;
  min-height: 0;
  padding: 16px;
  border: 1px solid var(--page-border-color);
  border-radius: var(--page-radius);
  background-color: var(--page-card-background);
  overflow: auto;
}

.home-page__schedule {
  display: flex;
  flex-direction: column;
}

.home-page__schedule :deep(.schedule-viewport) {
  flex: 1;
}

.home-page__state {
  display: grid;
  place-items: center;
  min-height: 180px;
  margin: 0;
  border: 1px dashed var(--page-border-color);
  border-radius: var(--page-radius);
  background-color: var(--page-card-background);
  color: var(--schedule-state-color);
  font-size: 14px;
  text-align: center;
}

.home-page__state--error {
  gap: 12px;
  color: var(--page-danger-color);
}

.home-page__state--error button {
  padding: 8px 16px;
  border: 1px solid currentColor;
  border-radius: 999px;
  background-color: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.home-page__empty {
  margin: 0;
  color: var(--schedule-state-color);
  font-size: 14px;
}

@media (max-width: 1100px) {
  .home-page__layout {
    grid-template-rows: auto 70vh auto;
    min-height: 0;
  }

  .home-page__upper {
    grid-template-columns: 1fr;
  }

  .home-page__schedule {
    min-height: 70vh;
  }
}
</style>
