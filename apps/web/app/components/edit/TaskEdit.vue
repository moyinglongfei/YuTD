<script setup lang="ts">
import TaskBlock, { type TaskBlockData } from '../preview/Task/TaskBlock.vue'
import WeekPicker from '../common/WeekPicker.vue'
import Background from '../image/BackgroundLayout.vue'
import BackgroundSelect, { type BackgroundSelection } from '../image/BackgroundSelect.vue'
import { CardStyleKey } from '../preview/card/cardMaterial'
import { calendarDate, clockParts, parseZonedDateTime } from '~/utils/date'

export type EditableTask = ApiData<Api['api']['task']['get']>[number]
const props = withDefaults(defineProps<{ task?: EditableTask | null, phaseId: number, eventId?: number, date?: string, allowNew?: boolean }>(), { allowNew: true })
const emit = defineEmits<{ saved: [task: EditableTask], new: [] }>()
const { timeZone } = useSystemTime()
const theme = inject(CardStyleKey, undefined)
const fancy = computed(() => theme?.value.showMode === 1)
const backgroundSelection = shallowRef<BackgroundSelection | null>(null)
const backgroundPending = ref(true)
watch([fancy, () => props.phaseId], () => {
  backgroundSelection.value = null
  backgroundPending.value = true
})
const activeTask = shallowRef<EditableTask | null>(null)
const form = reactive({ title: '', description: '', priority: 3, dueDate: '', plannedDate: '', eventId: null as number | null,
  status: 'TODO' as EditableTask['status'], tags: '', reminderTimes: '' })
const saving = ref(false)
const error = ref('')
const element = ref<HTMLElement | null>(null)
let revision = 0

function localDateTime(date: Date) {
  const parts = clockParts(date, timeZone.value)
  return `${calendarDate(date, timeZone.value)}T${[parts.hour, parts.minute, parts.second].map(value => String(value).padStart(2, '0')).join(':')}`
}

function loadTask(task: EditableTask | null) {
  revision++
  saving.value = false
  activeTask.value = task
  error.value = ''
  Object.assign(form, {
    title: task?.title ?? '', description: task?.description ?? '', priority: task?.priority ?? 3,
    dueDate: task ? task.dueDate ? localDateTime(task.dueDate) : '' : props.date ? `${props.date}T23:59:00` : '', eventId: task ? task.eventId : props.eventId ?? null,
    plannedDate: task?.plannedDate ? localDateTime(task.plannedDate) : '',
    status: task?.status ?? 'TODO', tags: task?.tags.map(tag => tag.name).join(', ') ?? '',
    reminderTimes: task?.reminders.map(reminder => localDateTime(reminder.time)).join('\n') ?? ''
  })
}

watch([() => props.task, () => props.phaseId, () => props.eventId, () => props.date], ([task, phaseId, eventId, date], previous) => {
  if (previous && phaseId === previous[1] && eventId === previous[2] && date === previous[3] && task?.id === activeTask.value?.id) return
  loadTask(task ?? null)
}, { immediate: true })

const eventsClient = useApi({
  key: () => `events:${props.phaseId}`,
  read: api => api.api.event.get({ query: { phaseId: props.phaseId } })
})
const { data: events, pending: eventsPending, error: eventsError, refresh: refreshEvents } = useAsyncData(eventsClient.key, eventsClient.read, { deep: true })
const selectedEvent = computed(() => events.value?.find(event => event.id === form.eventId) ?? (activeTask.value?.eventId === form.eventId ? activeTask.value?.event : null))
function previewDate(value: string) {
  if (!value) return null
  try {
    return parseZonedDateTime(value, timeZone.value)
  } catch {
    return null
  }
}
const preview = computed<TaskBlockData>(() => ({
  id: activeTask.value?.id ?? 0, phaseId: props.phaseId, title: form.title || '新建任务', description: form.description,
  priority: form.priority, status: form.status, completed: form.status === 'DONE', completedAt: activeTask.value?.completedAt ?? null,
  event: selectedEvent.value ?? null, dueDate: previewDate(form.dueDate),
  plannedDate: previewDate(form.plannedDate),
  tags: form.tags.split(/[,，\r\n]+/).map(name => name.trim()).filter(Boolean).map(name => ({ name })),
  tips: activeTask.value?.tips ?? []
}))
const planMaximum = computed(() => {
  const due = previewDate(form.dueDate)
  return due ? localDateTime(new Date(due.getTime() - 1000)) : undefined
})

function taskData() {
  const title = form.title.trim()
  if (!title) throw new Error('请输入任务名称')
  if (!Number.isInteger(form.priority) || form.priority < 1 || form.priority > 5) throw new Error('优先级必须为 1 至 5 的整数')
  if (!form.dueDate) throw new Error('请选择截止时间')
  const due = parseZonedDateTime(form.dueDate, timeZone.value)
  const plannedDate = form.plannedDate ? parseZonedDateTime(form.plannedDate, timeZone.value) : null
  if (plannedDate && plannedDate >= due) throw new Error('计划时间必须早于截止时间')
  if (form.eventId !== null && !selectedEvent.value) throw new Error('请选择当前阶段的有效事件')
  return {
    title, description: form.description.trim(), priority: form.priority, status: form.status,
    dueDate: due.toISOString(), plannedDate: plannedDate?.toISOString() ?? null, eventId: form.eventId,
    tags: [...new Set(preview.value.tags.map(tag => tag.name))],
    reminderTimes: [...new Set(form.reminderTimes.split(/\r?\n/).map(value => value.trim()).filter(Boolean)
      .map(value => parseZonedDateTime(value, timeZone.value).toISOString()))]
  }
}
const client = useApi({
  key: () => `tasks:${props.phaseId}:all`,
  write: (api, data: ReturnType<typeof taskData>) => activeTask.value
    ? api.api.task({ id: activeTask.value.id }).patch(data)
    : api.api.task.post({ ...data, plannedDate: data.plannedDate ?? undefined, eventId: data.eventId ?? undefined, phaseId: props.phaseId })
})
async function save() {
  if (saving.value) return
  const current = revision
  error.value = ''
  try {
    const data = taskData()
    saving.value = true
    const task = await client.write(data)
    if (current !== revision) return
    loadTask(task)
    emit('saved', task)
  } catch (cause) {
    if (current === revision) error.value = cause instanceof Error ? cause.message : '保存任务失败，请重试。'
  } finally {
    if (current === revision) saving.value = false
  }
}
function startNew() {
  loadTask(null)
  emit('new')
}
defineExpose({ saving, focus: () => element.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }) })
</script>

<template>
  <section
    ref="element"
    class="edit-task item-card"
    :class="{ 'edit-task--fancy': fancy }"
  >
    <header class="edit-task__heading">
      <h2 class="panel-title">
        {{ activeTask ? '编辑任务' : '新建任务' }}
      </h2>
      <button
        v-if="activeTask && allowNew"
        class="button"
        type="button"
        :disabled="saving"
        @click="startNew"
      >
        新建任务
      </button>
    </header>
    <div
      v-if="fancy"
      hidden
    >
      <BackgroundSelect
        :key="phaseId"
        :background-key="`schedule:${phaseId}`"
        @change="backgroundSelection = $event"
        @loading-change="backgroundPending = $event"
      />
    </div>
    <Background
      class="edit-task__background"
      :pending="fancy && backgroundPending"
      :image="fancy ? backgroundSelection?.image ?? '/images/bg.png' : ''"
      :position="fancy ? backgroundSelection?.position : undefined"
      :simplified-image="fancy ? backgroundSelection?.simplifiedImage : undefined"
      :analysis="fancy ? backgroundSelection?.analysis : undefined"
    >
      <TaskBlock
        :task="preview"
        :detail="3"
        :interactive="false"
        class="edit-task__block"
      >
        <template #default="{ textColor }">
          <form
            class="edit-task__form panel-stack"
            :style="{ color: textColor }"
            @submit.prevent="save"
          >
            <fieldset
              class="panel-stack"
              :disabled="saving"
            >
              <label class="form-field">
                <span>任务名称</span>
                <input
                  v-model="form.title"
                  class="form-control"
                  aria-label="任务名称"
                  placeholder="例如：完成本周作业"
                  required
                >
              </label>
              <label class="form-field">
                <span>描述</span>
                <textarea
                  v-model="form.description"
                  class="form-control"
                  aria-label="任务描述"
                  rows="3"
                  placeholder="选填"
                />
              </label>
              <div class="form-grid">
                <div class="form-field">
                  <span>优先级 · {{ form.priority }}</span>
                  <WeekPicker
                    :count="5"
                    :model-value="[form.priority]"
                    selectable
                    exclusive
                    :color="textColor"
                    aria-label="任务优先级"
                    @update:model-value="form.priority = $event[0] ?? 3"
                  />
                </div>
                <label class="form-field">
                  <span>状态</span>
                  <select
                    v-model="form.status"
                    class="form-control"
                    aria-label="任务状态"
                  >
                    <option value="TODO">待办</option><option value="DOING">进行中</option><option value="DONE">已完成</option><option value="CANCELLED">已取消</option>
                  </select>
                </label>
              </div>
              <label class="form-field">
                <span>关联事件</span>
                <select
                  v-model="form.eventId"
                  class="form-control"
                  aria-label="任务关联事件"
                  :disabled="eventsPending && !events"
                >
                  <option :value="null">不关联事件</option>
                  <option
                    v-for="event in events"
                    :key="event.id"
                    :value="event.id"
                  >{{ event.name }}</option>
                  <option
                    v-if="form.eventId && selectedEvent && !events?.some(event => event.id === form.eventId)"
                    :value="form.eventId"
                  >{{ selectedEvent.name }}</option>
                </select>
              </label>
              <div
                v-if="eventsError"
                class="edit-task__event-error"
                role="alert"
              >
                <span>关联事件加载失败。</span><button
                  type="button"
                  class="button"
                  @click="refreshEvents()"
                >
                  重试
                </button>
              </div>
              <label class="form-field">
                <span>截止时间 · {{ timeZone }} · 必填</span>
                <input
                  v-model="form.dueDate"
                  class="form-control"
                  type="datetime-local"
                  step="1"
                  aria-label="任务截止时间"
                  required
                >
              </label>
              <label class="form-field">
                <span>计划时间 · {{ timeZone }} · 选填，需早于截止时间</span>
                <input
                  v-model="form.plannedDate"
                  class="form-control"
                  type="datetime-local"
                  step="1"
                  :max="planMaximum"
                  aria-label="任务计划时间"
                >
              </label>
              <label class="form-field">
                <span>提醒时间 · {{ timeZone }}</span>
                <textarea
                  v-model="form.reminderTimes"
                  class="form-control"
                  rows="2"
                  aria-label="任务提醒时间"
                  placeholder="选填，每行一个日期时间，例如 2026-11-06T09:00"
                />
              </label>
              <label class="form-field">
                <span>标签</span>
                <input
                  v-model="form.tags"
                  class="form-control"
                  aria-label="任务标签"
                  placeholder="选填，用逗号分隔"
                >
              </label>
            </fieldset>
            <p
              v-if="error"
              role="alert"
              class="edit-task__error"
            >
              {{ error }}
            </p>
            <button
              type="submit"
              class="button edit-task__submit"
              :disabled="saving"
            >
              {{ saving ? '正在保存……' : activeTask ? '保存任务' : '创建任务' }}
            </button>
          </form>
        </template>
      </TaskBlock>
    </Background>
  </section>
</template>

<style scoped>
.edit-task { min-width: 0; scroll-margin-top: 16px; }
.edit-task__heading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
.edit-task__heading h2 { margin: 0; }
.edit-task > .edit-task__background { height: auto; overflow: clip; border-radius: 12px; margin-top: 16px; }
.edit-task__block { border-radius: 12px; }
.edit-task__form { min-width: 0; }
.edit-task__form .form-field { color: inherit; }
.edit-task__form .form-control { color: inherit; background: transparent; border-color: color-mix(in srgb, currentColor 35%, transparent); }
.edit-task__form .form-control::placeholder { color: inherit; opacity: .6; }
.edit-task__form select option { color: var(--text-primary); background: var(--background-secondary); }
.edit-task__form .button { color: inherit; border-color: color-mix(in srgb, currentColor 50%, transparent); background: transparent; }
.edit-task__form .button:hover:not(:disabled) { background: color-mix(in srgb, currentColor 12%, transparent); }
.edit-task__event-error { display: flex; align-items: center; gap: 10px; font-size: 13px; }
.edit-task__error { margin: 0; font-size: 13px; }
.edit-task__submit { justify-self: end; }
</style>
