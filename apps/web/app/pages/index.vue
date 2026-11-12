<script setup lang="ts">
import TaskAttentionList from '~/components/preview/Task/TaskAttentionList.vue'
import { useApi } from '~/composables/useApi'

const preferencesClient = useApi({
  key: 'preferences',
  read: api => api.api.preferences.get(),
  write: (api, value: ApiData<Api['api']['preferences']['get']>) => api.api.preferences.put(value)
})
const preferencesClientState = useAsyncData(preferencesClient.key, preferencesClient.read, { deep: true })
const { data: preferences } = preferencesClientState
const { data: phases } = useNuxtData<ApiData<Api['api']['phase']['get']>>('phases')

const selectedPhaseId = computed(() => preferences.value?.defaultPhaseId ?? null)
const { now, timeZone } = useSystemTime()
const displayedDay = computed(() => now.value ? calendarDate(now.value, timeZone.value) : null)
const displayedWeekdays = computed(() => displayedDay.value
  ? [calendarWeekday(displayedDay.value), calendarWeekday(addCalendarDays(displayedDay.value, 1))]
  : [])

const phaseClient = useApi({
  key: () => `phase:${selectedPhaseId.value ?? 'none'}`,
  read: async api => selectedPhaseId.value === null
    ? null
    : api.api.phase({ id: selectedPhaseId.value }).get()
})
const phaseClientState = useAsyncData(phaseClient.key, phaseClient.read, { deep: true })
const { data: phase, pending: loading, refresh } = phaseClientState

function EventHover(id: number | null) {
  if (id !== null) {
    console.log(`Hovered Event ID: ${id}`)
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
    <PageCard
      v-if="!phase || phase.id !== selectedPhaseId"
      class="home-page__state"
      width="100%"
      height="100%"
    >
      <p
        v-if="loading && selectedPhaseId !== null"
        class="page-state"
        role="status"
      >
        正在加载阶段……
      </p>
      <p
        v-else-if="phases?.length === 0"
        class="page-state"
      >
        <span>
          还没有阶段。点击侧边栏的
          <Icon
            class="phase-create-hint-icon"
            name="lucide:pen-line"
            role="img"
            aria-label="铅笔"
          />
          开启编辑模式，再点
          <Icon
            class="phase-create-hint-icon"
            name="lucide:plus"
            role="img"
            aria-label="加号"
          />
          选择「阶段」，创建你的首个 Phase。
        </span>
      </p>
      <p
        v-else-if="selectedPhaseId === null"
        class="page-state"
      >
        请先在边栏选择一个 Phase 喵。
      </p>
      <div
        v-else
        class="page-state"
      >
        <p>阶段尚未载入。</p>
        <button
          class="button"
          type="button"
          @click="refresh()"
        >
          重新加载
        </button>
      </div>
    </PageCard>
    <div
      v-else-if="phase && phase.id === selectedPhaseId"
      class="home-page__layout"
    >
      <PageCard
        class="home-page__schedule"
        width="100%"
        height="100%"
        aria-label="课程表"
      >
        <ScheduleTable
          v-if="displayedWeekdays.length"
          :key="phase.id"
          :phase-id="phase.id"
          mode="custom"
          background-key="home:schedule"
          :weekdays="displayedWeekdays"
          auto-center
          @event-hover="EventHover($event)"
          @task-hover="TaskHover($event)"
        />
        <p
          v-else
          class="page-state"
          role="status"
        >
          正在确认日期……
        </p>
      </PageCard>
      <PageCard
        class="home-page__tasks"
        width="100%"
        height="100%"
        aria-label="任务"
      >
        <TaskAttentionList
          :phase-id="phase.id"
          @task-hover="TaskHover($event)"
        />
      </PageCard>
      <PageCard
        class="home-page__sentence"
        width="100%"
        height="100%"
        aria-label="每日一句"
      />
      <PageCard
        class="home-page__tips"
        width="100%"
        height="100%"
        aria-label="每日提示"
      >
        <DailyTips :phase-id="phase.id" />
      </PageCard>
    </div>
  </main>
</template>

<style scoped>
.home-page {
  display: flex;
  flex-direction: column;
  gap: 7px;
  width: 100%;
  height: var(--app-content-height);
  min-width: 0;
  padding: 7px;
  overflow: hidden;
  background:
    radial-gradient(ellipse at 8% 8%, color-mix(in srgb, var(--text-secondary) 12%, transparent), transparent 55%),
    radial-gradient(ellipse at 95% 85%, color-mix(in srgb, var(--background-secondary) 65%, transparent), transparent 50%),
    var(--background-primary);
}

.home-page__layout {
  display: grid;
  width: 100%;
  flex: 1;
  min-width: 0;
  min-height: 0;
  grid-template-columns: minmax(0, 7fr) minmax(0, 13fr);
  grid-template-rows: minmax(0, 7fr) minmax(0, 1fr) minmax(0, 2fr);
  grid-template-areas:
    'schedule tasks'
    'schedule sentence'
    'schedule tips';
  gap: 7px;
}
.home-page__state { flex: 1; }

.home-page__schedule {
  grid-area: schedule;
}

.home-page__tasks {
  grid-area: tasks;
}

.home-page__sentence {
  grid-area: sentence;
}

.home-page__tips {
  grid-area: tips;
}
</style>
