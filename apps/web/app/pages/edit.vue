<script setup lang="ts">
import EventPreview from '~/components/preview/EventPreview.vue'
import EventWrite from '~/components/write/EventWrite.vue'
import PhasePreview from '~/components/preview/PhasePreview.vue'
import PhaseWrite from '~/components/write/PhaseWrite.vue'
import TaskPreview from '~/components/preview/TaskPreview.vue'
import TaskWrite from '~/components/write/TaskWrite.vue'
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

async function refreshEditingData() {
  const phaseId = selectedPhaseId.value
  const keys = [
    'phases',
    `phase:${phaseId ?? 'none'}`
  ]

  if (phaseId !== null) {
    keys.push(
      `events:${phaseId}`,
      `tasks:${phaseId}:all`
    )
  }

  await refreshNuxtData(keys)
}
</script>

<template>
  <main class="edit-page">
    <section class="edit-page__container">
      <header class="edit-page__header">
        <p class="edit-page__eyebrow">
          数据编辑
        </p>
        <h1 class="edit-page__title">
          {{ phase?.name ?? '请选择 Phase' }}
        </h1>
      </header>

      <div class="edit-page__workspace">
        <aside class="edit-page__phase">
          <PhasePreview
            :selected-id="selectedPhaseId ?? undefined"
            @select="selectedPhaseId = $event"
          />
        </aside>

        <div class="edit-page__content">
          <div
            v-if="readError"
            class="edit-page__state edit-page__state--error"
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
            class="edit-page__state"
            role="status"
          >
            正在加载阶段……
          </p>
          <p
            v-else-if="selectedPhaseId === null"
            class="edit-page__state"
          >
            请先在边栏或阶段预览中选择一个 Phase 喵。
          </p>

          <div
            v-else-if="phase && phase.id === selectedPhaseId"
            class="edit-page__forms"
          >
            <EventWrite
              :key="phase.id"
              :phase-id="phase.id"
              @created="refreshEditingData"
            />
            <PhaseWrite @created="refreshEditingData" />
            <TaskWrite
              :key="phase.id"
              :phase-id="phase.id"
              @created="refreshEditingData"
            />
          </div>
        </div>
      </div>

      <div
        v-if="phase && phase.id === selectedPhaseId"
        class="edit-page__previews"
      >
        <EventPreview :phase-id="phase.id" />
        <TaskPreview :phase-id="phase.id" />
      </div>
    </section>
  </main>
</template>
