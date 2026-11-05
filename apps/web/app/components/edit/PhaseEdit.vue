<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import AppPopup from '../common/AppPopup.vue'

type Preferences = ApiData<Api['api']['preferences']['get']>
type Phase = ApiData<Api['api']['phase']['get']>[number]
const props = defineProps<{ anchor?: HTMLElement | null, phaseId?: number | null }>()
const createMenuOpen = defineModel<boolean>('open', { default: false })
const PhaseEditPopup = defineAsyncComponent(() => import('./PhaseEditPopup.vue'))
const EventEditPopup = defineAsyncComponent(() => import('./EventEditPopup.vue'))
const TaskEditPopup = defineAsyncComponent(() => import('./TaskEditPopup.vue'))
const app = useNuxtApp()
const { now, timeZone } = useSystemTime()
const { mode } = useSystemStatus()
const writePreferencesClient = useApi({
  key: 'preferences',
  read: api => api.api.preferences.get(),
  write: (api, value: Preferences) => api.api.preferences.put(value)
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
const phasesClient = useApi({
  key: 'phases',
  read: api => api.api.phase.get()
})
const phasesClientState = useAsyncData(phasesClient.key, phasesClient.read, { deep: true })
const { data: phases } = phasesClientState

const creating = ref<'phase' | 'event' | 'task' | null>(null)
const creationPhase = shallowRef<Phase | null>(null)
const selectedCreationPhase = computed(() => {
  const phaseId = props.phaseId === undefined ? preferences.value?.defaultPhaseId : props.phaseId
  return phases.value?.find(phase => phase.id === phaseId)
})
const creationDate = ref('')
function create(type: 'phase' | 'event' | 'task') {
  if (type !== 'phase' && !selectedCreationPhase.value) return
  creationPhase.value = selectedCreationPhase.value ?? null
  creationDate.value = calendarDate(now.value ?? new Date(), timeZone.value)
  createMenuOpen.value = false
  creating.value = type
}
watch(mode, (value) => {
  if (value === 'edit') return
  createMenuOpen.value = false
  creating.value = null
})
async function phaseSaved(phase: ApiData<Api['api']['phase']['post']>) {
  const previous = phases.value?.find(value => value.id === phase.id)
  phases.value = [...(phases.value ?? []).filter(value => value.id !== phase.id), {
    ...phase, _count: previous?._count ?? { events: 0, tasks: 0 }
  }].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
  if (!preferences.value) await writePreferencesClientState.refresh()
  if (preferences.value) await writePreferences({ ...preferences.value, defaultPhaseId: phase.id })
  await phasesClientState.refresh()
}
async function contentSaved() {
  const prefixes = ['phase:', 'schedule:', 'events:', 'tasks:', 'taskAttention:', 'dailytips:', 'resources:']
  const keys = Object.keys(app.payload.data).filter(key => key === 'phases' || prefixes.some(prefix => key.startsWith(prefix)))
  await app.runWithContext(() => refreshNuxtData(keys))
}
</script>

<template>
  <AppPopup
    v-model:open="createMenuOpen"
    mode="popover"
    title="新建内容"
    class="phase-create-popup"
    :anchor="props.anchor"
  >
    <div class="panel-stack">
      <button
        class="button phase-create-option"
        type="button"
        @click="create('phase')"
      >
        <Icon name="lucide:calendar-range" />
        阶段 · Phase
      </button>
      <button
        v-if="selectedCreationPhase"
        class="button phase-create-option"
        type="button"
        @click="create('event')"
      >
        <Icon name="lucide:calendar-days" />
        课程 · Event
      </button>
      <button
        v-if="selectedCreationPhase"
        class="button phase-create-option"
        type="button"
        @click="create('task')"
      >
        <Icon name="lucide:list-todo" />
        任务 · Task
      </button>
    </div>
  </AppPopup>
  <PhaseEditPopup
    v-if="creating === 'phase'"
    :open="true"
    @update:open="!$event && (creating = null)"
    @saved="phaseSaved"
  />
  <EventEditPopup
    v-if="creating === 'event' && creationPhase"
    :open="true"
    :phase-id="creationPhase.id"
    :week-count="creationPhase.weekCount"
    @update:open="!$event && (creating = null)"
    @saved="contentSaved"
    @task-saved="contentSaved"
  />
  <TaskEditPopup
    v-if="creating === 'task' && creationPhase"
    :open="true"
    :phase-id="creationPhase.id"
    :date="creationDate"
    :editing="true"
    @update:open="!$event && (creating = null)"
    @saved="contentSaved"
  />
</template>

<style scoped>
.phase-create-popup.app-popup { --popup-width: 300px; padding: 16px; border: 1px solid var(--border-color); border-radius: 14px; background: var(--background-secondary); }
.phase-create-option { justify-content: flex-start; gap: 10px; width: 100%; }
</style>
