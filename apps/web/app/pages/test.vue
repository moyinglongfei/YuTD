<script setup lang="ts">
import EventWrite from '~/components/write/EventWrite.vue'
import PhaseWrite from '~/components/write/PhaseWrite.vue'
import TaskWrite from '~/components/write/TaskWrite.vue'
import PhasePreview from '~/components/preview/PhasePreview.vue'
import EventPreview from '~/components/preview/EventPreview.vue'
import TaskPreview from '~/components/preview/TaskPreview.vue'
import { requestApiData } from '~/utils/api'
import { useRead } from '~/composables/useRead'

const { $api } = useNuxtApp()
const scheduleVersion = ref(0)
const phaseId = ref(6)

const { data: phase, loading, readError, refresh } = useRead(
  () => `phase:${phaseId.value}`,
  () => requestApiData($api.api.phase({ id: phaseId.value }).get(), '获取阶段失败')
)

async function refreshPreviews() {
  scheduleVersion.value++
  await refreshNuxtData([
    'phases',
    `phase:${phaseId.value}`,
    `events:${phaseId.value}`,
    `tasks:${phaseId.value}:all`
  ])
}
</script>

<template>
  <main class="min-h-screen bg-stone-100 px-4 py-10 text-slate-900 sm:px-8">
    <section class="mx-auto max-w-7xl">
      <div class="mb-6">
        <p class="text-sm font-semibold text-primary-700">
          YuTD · Schedule Test
        </p>
        <h1 class="mt-1 text-2xl font-bold tracking-tight">
          {{ phase?.id === phaseId ? phase.name : '日程表测试页' }}
        </h1>
      </div>

      <PhasePreview
        :selected-id="phaseId"
        class="mb-6"
        @select="phaseId = $event"
      />
      <div
        v-if="readError"
        class="mb-6 space-y-3"
      >
        <UAlert
          color="error"
          variant="soft"
          :title="readError"
        />
        <UButton
          color="neutral"
          variant="outline"
          :loading="loading"
          :disabled="loading"
          @click="refresh()"
        >
          重试
        </UButton>
      </div>
      <p
        v-else-if="loading"
        class="mb-6 text-sm text-muted"
        role="status"
      >
        正在加载阶段……
      </p>
      <ScheduleTable
        v-if="phase && phase.id === phaseId && !readError"
        :key="`${phase.id}-${scheduleVersion}`"
        :phase-id="phase.id"
      />
      <div
        v-if="phase && phase.id === phaseId && !readError"
        class="mt-6 grid items-start gap-6 lg:grid-cols-2"
      >
        <EventPreview :phase-id="phase.id" />
        <TaskPreview :phase-id="phase.id" />
      </div>
      <div class="mt-8 grid items-start gap-6 lg:grid-cols-2">
        <EventWrite
          v-if="phase && phase.id === phaseId && !readError"
          :key="phase.id"
          :phase-id="phase.id"
          class="lg:col-span-2"
          @created="refreshPreviews"
        />
        <PhaseWrite @created="refreshPreviews" />
        <TaskWrite
          v-if="phase && phase.id === phaseId && !readError"
          :key="phase.id"
          :phase-id="phase.id"
          @created="refreshPreviews"
        />
      </div>
    </section>
  </main>
</template>
