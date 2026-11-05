<script setup lang="ts">
import EventEdit from '~/components/edit/EventEdit.vue'
import type { EditableEvent } from '~/components/edit/EventEdit.vue'
import TaskEdit from '~/components/edit/TaskEdit.vue'
import TaskEditPopup from '~/components/edit/TaskEditPopup.vue'
import { useApi } from '~/composables/useApi'

const nuxtApp = useNuxtApp()

const writePreferencesClient = useApi({
  key: 'preferences',
  read: api => api.api.preferences.get(),
  write: (api, value: ApiData<Api['api']['preferences']['get']>) => api.api.preferences.put(value)
})
const writePreferencesClientState = useAsyncData(writePreferencesClient.key, writePreferencesClient.read, { deep: true })
const { data: preferences } = writePreferencesClientState
async function writePreferences(value: Parameters<typeof writePreferencesClient.write>[0]) {
  try {
    const result = await writePreferencesClient.write(value)
    await writePreferencesClientState.refresh()
    return result
  } catch {
    return undefined
  }
}
const selectedPhaseId = computed({
  get: () => preferences.value?.defaultPhaseId ?? null,
  set: (value: number | null) => {
    if (preferences.value)
      void writePreferences({ ...preferences.value, defaultPhaseId: value })
  }
})

const phaseClient = useApi({
  key: () => `phase:${selectedPhaseId.value ?? 'none'}`,
  read: async api => selectedPhaseId.value === null
    ? null
    : api.api.phase({ id: selectedPhaseId.value }).get()
})
const phaseClientState = useAsyncData(phaseClient.key, phaseClient.read, { deep: true })
const { data: phase, pending: loading, refresh } = phaseClientState
const selectedEvent = shallowRef<EditableEvent | null>(null)
const taskEvent = shallowRef<EditableEvent | null>(null)
watch(selectedPhaseId, () => {
  selectedEvent.value = null
  taskEvent.value = null
})

async function eventSaved(event: EditableEvent) {
  selectedEvent.value = event
  await refreshEditingData()
}

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

  await nuxtApp.runWithContext(() => refreshNuxtData(keys))
}
</script>

<template>
  <main class="page-shell">
    <div class="page-container">
      <PageCard>
        <header class="page-heading">
          <p class="page-eyebrow">
            数据编辑
          </p>
          <h1>
            {{ phase?.name ?? '请选择 Phase' }}
          </h1>
        </header>
      </PageCard>

      <div class="edit-page__workspace">
        <div class="panel-stack">
          <PageCard
            v-if="!phase || phase.id !== selectedPhaseId"
          >
            <header class="content-heading">
              <h2 class="panel-title">
                编辑内容
              </h2>
            </header>
            <p
              v-if="loading && selectedPhaseId !== null"
              class="page-state"
              role="status"
            >
              正在加载阶段……
            </p>
            <p
              v-else-if="selectedPhaseId === null"
              class="page-state"
            >
              请先在边栏中选择一个 Phase 喵。
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
            class="panel-stack"
          >
            <EventEdit
              :key="phase.id"
              :phase-id="phase.id"
              :week-count="phase.weekCount"
              :event="selectedEvent"
              @saved="eventSaved"
              @new="selectedEvent = null"
              @add-task="taskEvent = $event"
            />
            <TaskEdit
              :key="phase.id"
              :phase-id="phase.id"
              @saved="refreshEditingData"
            />
          </div>
        </div>
      </div>

      <TaskEditPopup
        v-if="taskEvent"
        :open="true"
        :editing="true"
        :phase-id="taskEvent.phaseId"
        :event-id="taskEvent.id"
        @update:open="!$event && (taskEvent = null)"
        @saved="refreshEditingData"
      />
    </div>
  </main>
</template>

<style scoped>
.edit-page__workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: var(--page-gutter);
}
</style>
