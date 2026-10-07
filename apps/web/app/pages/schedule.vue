<script setup lang="ts">
import { requestApiData } from '~/utils/api'
import { useRead } from '~/composables/useRead'

const { $api } = useNuxtApp()
const selectedPhaseId = useState<number | null>('selectedPhaseId', () => null)

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
</script>

<template>
  <main class="schedule-page">
    <section class="schedule-page__container">
      <header class="schedule-page__header">
        <p class="schedule-page__eyebrow">
          完整课程表
        </p>
        <h1 class="schedule-page__title">
          {{ phase?.name ?? '等待选择 Phase' }}
        </h1>
        <p
          v-if="phase"
          class="schedule-page__meta"
        >
          共 {{ phase.weekCount }} 周 ·
          <NuxtTime
            :datetime="phase.startDate"
            locale="zh-CN"
            time-zone="UTC"
            year="numeric"
            month="2-digit"
            day="2-digit"
          />
          至
          <NuxtTime
            :datetime="phase.endDate"
            locale="zh-CN"
            time-zone="UTC"
            year="numeric"
            month="2-digit"
            day="2-digit"
          />
        </p>
      </header>

      <div
        v-if="readError"
        class="schedule-page__state schedule-page__state--error"
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
        class="schedule-page__state"
        role="status"
      >
        正在加载阶段……
      </p>
      <p
        v-else-if="selectedPhaseId === null"
        class="schedule-page__state"
      >
        请先在边栏选择一个 Phase 喵。
      </p>
      <ScheduleTable
        v-else-if="phase && phase.id === selectedPhaseId"
        :key="phase.id"
        :phase-id="phase.id"
      />
    </section>
  </main>
</template>
