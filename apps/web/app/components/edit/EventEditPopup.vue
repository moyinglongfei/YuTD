<script setup lang="ts">
import AppPopup from '../common/AppPopup.vue'
import EventEdit, { type EditableEvent } from './EventEdit.vue'
import TaskEditPopup from './TaskEditPopup.vue'
import type { EditableTask } from './TaskEdit.vue'
import { calendarDate, calendarDayNumber } from '~/utils/date'

const props = defineProps<{ eventId?: number, phaseId?: number, weekCount?: number, open: boolean }>()
const emit = defineEmits<{ 'update:open': [open: boolean], 'saved': [event: EditableEvent], 'task-saved': [task: EditableTask] }>()
const editor = ref<InstanceType<typeof EventEdit> | null>(null)
const taskPopup = ref<InstanceType<typeof TaskEditPopup> | null>(null)
const taskEvent = shallowRef<EditableEvent | null>(null)
watch(() => props.eventId, () => {
  taskEvent.value = null
})
const { mode } = useSystemStatus()
const client = useApi({
  key: () => `event:${props.eventId ?? `new:${props.phaseId}`}`,
  read: async api => props.eventId === undefined ? null : api.api.event({ id: props.eventId }).get()
})
const { data: fetchedEvent, pending, error, refresh } = useAsyncData(client.key, client.read, { deep: true, immediate: props.eventId !== undefined })
const event = shallowRef<(EditableEvent & { phase?: { startDate: Date, endDate: Date } }) | null>(fetchedEvent.value ?? null)
const editorPhaseId = computed(() => event.value?.phaseId ?? props.phaseId ?? 0)
// 刷新失败时保留已打开的编辑器及其中尚未保存的草稿。
watch([() => props.eventId, fetchedEvent], ([id, value]) => {
  if (id === undefined) return
  if (event.value?.id !== id) event.value = null
  if (value?.id === id) event.value = value
}, { immediate: true })
const weekCount = computed(() => {
  const phase = event.value?.phase
  if (!phase) return props.weekCount ?? 0
  return Math.floor((calendarDayNumber(calendarDate(phase.endDate, 'UTC'))
    - calendarDayNumber(calendarDate(phase.startDate, 'UTC'))) / 7) + 1
})

watch(mode, (value) => {
  if (value !== 'edit') emit('update:open', false)
})

function saved(value: EditableEvent) {
  if (props.eventId === undefined) event.value = value
  emit('saved', value)
  if (props.eventId !== undefined) void refresh()
}
function taskSaved(task: EditableTask) {
  emit('task-saved', task)
  const keys = Object.keys(useNuxtApp().payload.data).filter(key => key.startsWith('taskAttention:') || key.startsWith('tasks:'))
  void refreshNuxtData(keys)
}
</script>

<template>
  <AppPopup
    :open="open"
    :title="event || eventId ? '编辑课程' : '新建课程'"
    mode="dialog"
    class="event-edit-popup"
    :class="{ 'event-edit-popup--paired': Boolean(taskEvent) }"
    :close-on-outside="false"
    :dismissible="!editor?.saving && !taskPopup?.saving"
    @update:open="emit('update:open', $event)"
  >
    <p
      v-if="eventId !== undefined && pending && !event"
      role="status"
    >
      正在加载课程……
    </p>
    <div
      v-else-if="eventId !== undefined && !event"
      class="panel-stack"
      role="alert"
    >
      <p>课程加载失败，请重试。</p>
      <button
        type="button"
        class="button"
        :disabled="pending"
        @click="refresh()"
      >
        重新加载
      </button>
    </div>
    <p
      v-if="event && error"
      role="alert"
    >
      刷新课程失败，已保留当前编辑内容。
    </p>
    <EventEdit
      v-if="editorPhaseId > 0 && (event || eventId === undefined)"
      ref="editor"
      :event="event"
      :phase-id="editorPhaseId"
      :week-count="weekCount"
      :allow-new="false"
      @saved="saved"
      @add-task="taskEvent = $event"
    />
    <template
      v-if="taskEvent"
      #companion
    >
      <TaskEditPopup
        ref="taskPopup"
        :key="taskEvent.id"
        :open="true"
        mode="panel"
        :editing="true"
        :phase-id="taskEvent.phaseId"
        :event-id="taskEvent.id"
        @update:open="!$event && (taskEvent = null)"
        @saved="taskSaved"
      />
    </template>
  </AppPopup>
</template>

<style scoped>
.event-edit-popup { --popup-width: 980px; }
.event-edit-popup--paired { --popup-width: 1540px; }
.event-edit-popup :deep(.edit-event) { padding: 0; border: 0; background: transparent; }
</style>
