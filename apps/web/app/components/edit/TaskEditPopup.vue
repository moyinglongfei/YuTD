<script setup lang="ts">
import AppPopup from '../common/AppPopup.vue'
import TaskEdit, { type EditableTask } from './TaskEdit.vue'
import TaskBlock from '../preview/Task/TaskBlock.vue'
import Background from '../image/BackgroundLayout.vue'
import type { BackgroundSelection } from '../image/BackgroundSelect.vue'

const props = withDefaults(defineProps<{
  open: boolean
  task?: EditableTask | null
  phaseId: number
  eventId?: number
  date?: string
  editing?: boolean
  mode?: 'dialog' | 'panel'
  background?: BackgroundSelection | null
}>(), { editing: false, mode: 'dialog' })
const emit = defineEmits<{ 'update:open': [open: boolean], 'saved': [task: EditableTask], 'change': [] }>()
const editor = ref<InstanceType<typeof TaskEdit> | null>(null)
const { mode: systemMode } = useSystemStatus()
const editing = ref(props.editing || !props.task)
watch([() => props.task?.id, () => props.editing], () => {
  editing.value = props.editing || !props.task
})
watch(systemMode, (value) => {
  if (value !== 'edit' && editing.value && props.task) emit('update:open', false)
})
function saved(task: EditableTask) {
  emit('saved', task)
  emit('update:open', false)
}
defineExpose({ saving: computed(() => Boolean(editor.value?.saving)) })
</script>

<template>
  <AppPopup
    :open="open"
    :mode="mode"
    class="task-popup"
    :title="editing ? task ? '编辑任务' : '新建任务' : '任务详情'"
    :dismissible="!editor?.saving"
    :close-on-outside="!editing"
    @update:open="emit('update:open', $event)"
  >
    <template
      v-if="!editing && systemMode === 'edit'"
      #header-actions
    >
      <button
        class="button"
        type="button"
        aria-label="编辑当前任务"
        @click="editing = true"
      >
        <Icon
          name="lucide:pen-line"
          aria-hidden="true"
        />
      </button>
    </template>
    <TaskEdit
      v-if="editing"
      ref="editor"
      :task="task"
      :phase-id="phaseId"
      :event-id="eventId"
      :date="date"
      :allow-new="false"
      @saved="saved"
    />
    <Background
      v-else-if="task"
      class="task-popup__background"
      :image="background?.image ?? '/images/bg.png'"
      :position="background?.position"
      :analysis="background?.analysis"
      :simplified-image="background?.simplifiedImage"
    >
      <TaskBlock
        :task="task"
        :detail="3"
        @change="emit('change')"
      />
    </Background>
  </AppPopup>
</template>

<style scoped>
.task-popup { --popup-width: 640px; }
.task-popup :deep(.edit-task) { padding: 0; border: 0; background: transparent; }
.task-popup :deep(.task-block) { border-radius: 12px; }
.task-popup .task-popup__background { height: auto; overflow: clip; border-radius: 12px; }
</style>
