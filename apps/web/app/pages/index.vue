<script setup lang="ts">
// 导入
import TaskAttentionList from '~/components/preview/Task/TaskAttentionList.vue'
import { useApi } from '~/composables/useApi'

// 系统变量读取
const { now, timeZone } = useSystemTime()
const { preferences, loading: preferencesLoading } = useAppPeferences()

// API 读取
const phaseClient = useApi({
  key: () => `phase:${preferences.value?.defaultPhaseId ?? 'none'}`,
  watch: true,
  read: async (api) => {
    const phaseId = preferences.value?.defaultPhaseId
    if (!phaseId) return null
    return api.api.phase({ id: phaseId }).get()
  }
})

// 页面变量：响应式数据
const { data: phases } = useNuxtData<ApiData<Api['api']['phase']['get']>>('phases')
const { data: phase } = phaseClient

// 计算属性
const selectedPhaseId = computed(() => preferences.value?.defaultPhaseId ?? null)
const loading = computed(() => preferencesLoading.value || phaseClient.read.loading.value)
const displayedDay = computed(() => now.value ? calendarDate(now.value, timeZone.value) : null)
const displayedWeekdays = computed(() => displayedDay.value
  ? [calendarWeekday(displayedDay.value), calendarWeekday(addCalendarDays(displayedDay.value, 1))]
  : [])
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
        v-if="loading"
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

@media (width < 480px) {
  .home-page {
    gap: 0;
    padding: 0;
  }

  .home-page__layout {
    grid-template-columns: minmax(0, 4fr) minmax(0, 6fr);
    gap: 0;
  }

  .home-page__schedule {
    padding: 0;
  }
}
</style>
