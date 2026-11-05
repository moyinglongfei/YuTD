<script setup lang="ts">
import Card from '~/components/preview/card/Card.vue'
import { CardStyleKey } from '~/components/preview/card/cardMaterial'
import AppPopup from '~/components/common/AppPopup.vue'
import { BackgroundContextKey } from '~/components/image/background'

// 类型
type Task = ApiData<Api['api']['task']['get']>[number]
export type TaskBlockData = Pick<Task, 'id' | 'phaseId' | 'title' | 'description' | 'priority' | 'status' | 'completed' | 'completedAt' | 'plannedDate' | 'dueDate'> & {
  event: Pick<NonNullable<Task['event']>, 'name' | 'color'> | null
  tags: { name: string }[]
  tips: { id: number, content: string }[]
}
type TaskChange = { id: number, status: Task['status'], isDone: boolean } | { id: number, plannedDate: string }
// 组件逻辑
const props = withDefaults(defineProps<{
  task: TaskBlockData
  detail?: 0 | 1 | 2 | 3 // 0 预览，1 完成操作，2 延期和放弃操作，3 完整文字详情。
  variant?: 'card' | 'row'
  attentionDate?: string
  centerGlowColor?: string
  overdue?: 'due' | 'plan'
  interactive?: boolean
  editable?: boolean
}>(), { detail: 0, variant: 'card', interactive: true, editable: false })
const emit = defineEmits<{
  change: [taskId: number]
  edit: [taskId: number]
  detail: [taskId: number]
}>()
const { mode } = useSystemStatus()
// 系统依赖

const { now, timeZone } = useSystemTime()
const { reportError } = useAppErrors()
// Task 状态
const pendingTasks = useState<Record<number, boolean>>('tasks:completion-pending', () => ({}))
const previousStatuses = useState<Record<number, 'TODO' | 'DOING'>>('tasks:previous-statuses', () => ({}))
// API 逻辑
const taskApiClient = useApi({
  key: () => `tasks:${props.task.phaseId}:all`,
  read: api => api.api.task.get({ query: { phaseId: props.task.phaseId } }),
  write: (api, change: TaskChange) => 'plannedDate' in change
    ? api.api.task({ id: change.id }).postpone.patch({ plannedDate: change.plannedDate })
    : api.api.task({ id: change.id }).patch({ isDone: change.isDone, status: change.status })
})
const taskApi = taskApiClient
const taskApiState = useAsyncData(taskApiClient.key, taskApiClient.read, { deep: true, immediate: false })
const currentTask = computed(() => props.interactive ? taskApiState.data.value?.find(task => task.id === props.task.id) ?? props.task : props.task)
const completed = computed(() => currentTask.value.completed || currentTask.value.status === 'DONE' || currentTask.value.status === 'CANCELLED')
const pending = computed(() => Boolean(pendingTasks.value[props.task.id]))
const timestamp = (value: Task['plannedDate']) => value ? new Date(value).getTime() : NaN
const canPostpone = computed(() => props.detail >= 2 && !completed.value && !(timestamp(currentTask.value.dueDate) <= (now.value?.getTime() ?? Date.now())))
const canCancel = computed(() => props.detail >= 2 && !completed.value)
const completionTitle = computed(() => currentTask.value.completedAt
  ? `${currentTask.value.status === 'CANCELLED' ? '放弃' : '完成'}时间：${calendarDate(currentTask.value.completedAt, timeZone.value)} ${Object.values(clockParts(currentTask.value.completedAt, timeZone.value)).map(part => String(part).padStart(2, '0')).join(':')}`
  : '')
const deferOpen = ref(false)
const deferDate = ref('')
const deferError = ref('')

async function saveChange(change: TaskChange) {
  if (!props.interactive || props.detail === 0 || pending.value) return
  const id = currentTask.value.id
  pendingTasks.value[id] = true
  try {
    const saved = await taskApi.write(change).catch(() => undefined)
    await taskApiState.refresh()
    if (saved) emit('change', saved.id)
    return saved
  } finally {
    Reflect.deleteProperty(pendingTasks.value, id)
  }
}

async function toggleCompleted() {
  if (!props.interactive || props.detail === 0 || pending.value) return
  const id = currentTask.value.id
  const next = !completed.value
  if (next) previousStatuses.value[id] = currentTask.value.status === 'DOING' ? 'DOING' : 'TODO'
  await saveChange({ id, isDone: next, status: next ? 'DONE' : previousStatuses.value[id] ?? 'TODO' })
}

async function cancelTask() {
  if (!canCancel.value || pending.value) return
  const id = currentTask.value.id
  previousStatuses.value[id] = currentTask.value.status === 'DOING' ? 'DOING' : 'TODO'
  await saveChange({ id, status: 'CANCELLED', isDone: false })
}

function localDateTime(date: Date) {
  const parts = clockParts(date, timeZone.value)
  const clock = [parts.hour, parts.minute, parts.second].map(part => String(part).padStart(2, '0')).join(':')
  return `${calendarDate(date, timeZone.value)}T${clock}`
}
const deferMinimum = computed(() => localDateTime(new Date((now.value?.getTime() ?? Date.now()) + 1000)))
const deferMaximum = computed(() => {
  const due = currentTask.value.dueDate
  return due ? localDateTime(new Date(timestamp(due) - 1)) : undefined
})
function canDefer(date: Date) {
  const due = currentTask.value.dueDate
  return Number.isFinite(date.getTime()) && date.getTime() > (now.value?.getTime() ?? Date.now()) && (!due || date.getTime() < timestamp(due))
}
const deferPresets = computed(() => {
  const current = now.value ?? new Date()
  const local = localDateTime(current)
  const day = calendarDate(current, timeZone.value)
  const nextDay = (days: number) => parseZonedDateTime(`${addCalendarDays(day, days)}${local.slice(10)}`, timeZone.value, 'compatible')
  const presets = [
    { label: '一小时后', date: new Date(current.getTime() + 3600000) },
    { label: '延期一天', date: nextDay(1) },
    { label: '延期三天', date: nextDay(3) }
  ]
  if (currentTask.value.dueDate)
    presets.push({ label: '截止前一小时', date: new Date(timestamp(currentTask.value.dueDate) - 3600000) })
  return presets.map(preset => ({ ...preset, disabled: !canDefer(preset.date) }))
})

function openDefer() {
  if (!canPostpone.value || pending.value) return
  deferOpen.value = true
  deferError.value = ''
  const first = deferPresets.value.find(preset => !preset.disabled)
  const due = timestamp(currentTask.value.dueDate)
  deferDate.value = first ? localDateTime(first.date) : Number.isFinite(due) ? localDateTime(new Date(due - 1)) : ''
}

function closeDefer() {
  deferOpen.value = false
}

async function saveDefer() {
  if (!deferOpen.value || pending.value) return
  let date: Date
  try {
    if (!deferDate.value) throw new Error('请选择延期时间')
    date = parseZonedDateTime(deferDate.value, timeZone.value)
    if (!canPostpone.value || !canDefer(date)) throw new Error('延期时间必须晚于当前时间，并早于截止时间')
  } catch (error) {
    deferError.value = error instanceof Error ? error.message : '延期时间无效'
    reportError(deferError.value, '延期任务')
    return
  }
  const saved = await saveChange({ id: currentTask.value.id, plannedDate: date.toISOString() })
  if (saved) closeDefer()
  else deferError.value = '延期未保存，请检查截止时间后重试'
}

watch([() => props.task.id, timeZone, completed], closeDefer)
watch(() => props.detail, (detail) => {
  if (detail < 2) closeDefer()
})
const block = ref<HTMLElement | null>(null)
const background = inject(BackgroundContextKey, null)
const cardStyle = inject(CardStyleKey, null)
const simpleMaterial = computed(() => !background || cardStyle?.value.showMode === 0)
const glass = ref<InstanceType<typeof Card> | null>(null)
const glassColors = shallowRef<{ textColor: string | null, tone: 'dark' | 'light' | null } | null>(null)
const size = shallowRef({ width: 0, height: 0 })
let observer: ResizeObserver | undefined

const taskDates = computed(() => {
  const dates = [
    { kind: 'plan' as const, value: currentTask.value.plannedDate, label: '计划时间' },
    { kind: 'due' as const, value: currentTask.value.dueDate, label: '截止时间' }
  ]
  return dates.filter(date => Number.isFinite(timestamp(date.value)))
    .sort((a, b) => timestamp(a.value) - timestamp(b.value))
})
const currentDay = computed(() => now.value ? calendarDate(now.value, timeZone.value) : null)
const timing = computed(() => {
  const plan = taskDates.value.find(date => date.kind === 'plan')
  const due = taskDates.value.find(date => date.kind === 'due')
  if (completed.value) {
    const value = currentTask.value.completedAt
    return {
      date: Number.isFinite(timestamp(value)) ? { value, label: currentTask.value.status === 'CANCELLED' ? '放弃时间' : '完成时间' } : due ?? plan ?? null,
      glow: null
    }
  }
  const time = now.value?.getTime() ?? Date.now()
  const date = (due && timestamp(due.value) < time ? due : undefined)
    ?? (plan && timestamp(plan.value) < time ? plan : undefined)
    ?? taskDates.value[0] ?? null
  const both = plan && due && timestamp(plan.value) >= time && timestamp(due.value) >= time
    && currentDay.value === calendarDate(plan.value!, timeZone.value)
    && currentDay.value === calendarDate(due.value!, timeZone.value)
  return { date, glow: both ? 'both' : date?.kind ?? null }
})
const planExpired = computed(() => !completed.value && timestamp(currentTask.value.plannedDate) < (now.value?.getTime() ?? Date.now()))
const displayDates = computed(() => {
  const plan = taskDates.value.find(date => date.kind === 'plan')
  const due = taskDates.value.find(date => date.kind === 'due')
  if (completed.value || planExpired.value) return due ? [due] : []
  if (plan && due && calendarDate(plan.value!, timeZone.value) === calendarDate(due.value!, timeZone.value)) return [plan, due]
  const day = props.attentionDate ?? currentDay.value
  const onDay = taskDates.value.filter(date => day && calendarDate(date.value!, timeZone.value) === day)
  return onDay.length ? onDay : plan ? [plan] : due ? [due] : []
})
const hasDateArea = computed(() => displayDates.value.length > 0 || planExpired.value)
function dateLabel(date: { kind: 'plan' | 'due', value: Task['plannedDate'] }) {
  return date.kind === 'plan'
    ? '计划截止'
    : !completed.value && timestamp(date.value) < (now.value?.getTime() ?? Date.now()) ? '截止逾期' : '截止时间'
}
const centerGlowColor = computed(() => props.centerGlowColor ?? (timing.value.glow === 'plan' ? 'rgb(59 130 246 / .22)' : timing.value.glow ? 'rgb(239 68 68 / .22)' : 'rgb(255 255 255 / .10)'))
function dateTitle(date: { kind: 'plan' | 'due', value: Task['plannedDate'] }) {
  const parts = clockParts(date.value!, timeZone.value)
  return `${dateLabel(date)}：${calendarDate(date.value!, timeZone.value)} ${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`
}
function isDisplayDay(date: { value: Task['plannedDate'] }) {
  return calendarDate(date.value!, timeZone.value) === (props.attentionDate ?? currentDay.value)
}
const eventName = computed(() => currentTask.value.event?.name.trim() ?? '')
const tips = computed(() => currentTask.value.tips.filter(tip => tip.content.trim()))
const layout = computed(() => {
  const { width, height } = size.value
  if (props.variant === 'row') {
    const narrow = width <= 360
    const titleHeight = height - (hasDateArea.value ? displayDates.value.length > 1 ? 40 : 28 : 8)
    const fontSize = Math.max(10, Math.min(18, narrow ? titleHeight / 2.5 : height * 0.32))
    const titleLines = narrow ? Math.max(1, Math.min(4, Math.floor(titleHeight / (fontSize * 1.25)))) : 1
    return { compact: false, fontSize, titleLines, tipCount: 0, tipLines: 0 }
  }
  const area = width * height
  const compact = width < 100 || height < 92 || area < 14000
  const fontSize = Math.max(compact ? 8 : 12, Math.min(18, width * 0.08, height * 0.2))
  const compactDateHeight = hasDateArea.value && height > 40 ? displayDates.value.length > 1 ? 30 : 15 : 0
  const titleLines = compact
    ? Math.max(1, Math.min(3, Math.floor((height - 8 - compactDateHeight) / (fontSize * 1.25))))
    : height >= 124 ? 2 : 1
  const baseHeight = 34 + fontSize * 1.25 * titleLines
    + (eventName.value ? 17 + 6 : 0)
    + (hasDateArea.value ? displayDates.value.length * 14 + 6 : 0)
  const tipHeight = height - baseHeight - 6
  const tipCount = !compact && width >= 136 && area >= 24000
    ? Math.max(0, Math.min(tips.value.length, Math.floor((tipHeight + 4) / 36)))
    : 0
  const tipLines = tipCount
    ? Math.min(3, Math.floor((tipHeight - (tipCount - 1) * 4) / (tipCount * 16)))
    : 0
  return { compact, fontSize, titleLines, tipCount, tipLines }
})
const visibleTips = computed(() => props.variant === 'row' ? [] : props.detail === 3 ? tips.value : tips.value.slice(0, layout.value.tipCount))
const statusText = computed(() => ({ TODO: '待办', DOING: '进行中', DONE: '已完成', CANCELLED: '已取消' })[currentTask.value.status])
const blockStyle = computed(() => ({
  '--task-row-action-size': `${Math.max(12, Math.min(26, size.value.height * 0.55))}px`,
  '--task-row-bottom-space': hasDateArea.value ? displayDates.value.length > 1 ? '34px' : '20px' : '4px',
  '--task-action-count': 1 + Number(canPostpone.value) + Number(canCancel.value) + Number(props.editable && mode.value === 'edit'),
  '--event-color': currentTask.value.event?.color ?? 'var(--text-primary)',
  '--task-title-size': `${layout.value.fontSize}px`,
  '--task-title-lines': layout.value.titleLines,
  '--task-tip-lines': layout.value.tipLines,
  '--task-foreground': glassColors.value?.textColor ?? 'var(--text-primary)',
  '--task-text-shadow': simpleMaterial.value ? 'none' : `0 1px 2px rgb(${glassColors.value?.tone === 'light' ? '255 255 255' : '0 0 0'} / .95)`,
  '--task-detail-backdrop': simpleMaterial.value ? 'transparent' : glassColors.value?.tone === 'light' ? 'rgb(255 255 255 / .68)' : glassColors.value?.tone === 'dark' ? 'rgb(0 0 0 / .68)' : 'transparent',
  '--task-readability-backdrop': simpleMaterial.value ? 'transparent' : glassColors.value?.tone === 'light' ? 'rgb(255 255 255 / .24)' : glassColors.value?.tone === 'dark' ? 'rgb(0 0 0 / .2)' : 'color-mix(in srgb, var(--background-secondary) 24%, transparent)',
  '--task-glow': timing.value.glow === 'plan' ? '#3b82f6' : timing.value.glow ? '#ef4444' : 'var(--text-secondary)'
}))

onMounted(() => {
  if (!block.value)
    return
  observer = new ResizeObserver(([entry]) => {
    if (entry)
      size.value = { width: entry.contentRect.width, height: entry.contentRect.height }
  })
  observer.observe(block.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  closeDefer()
})

defineExpose({ updateRect: () => glass.value?.updateRect() })
</script>

<template>
  <div
    ref="block"
    class="task-block"
    :class="{
      'task-block--compact': detail < 3 && layout.compact,
      'task-block--completed': detail > 0 && detail < 3 && completed,
      'task-block--detail': detail === 3 && variant !== 'row',
      'task-block--both': timing.glow === 'both',
      'task-block--preview': detail === 0,
      'task-block--row': variant === 'row'
    }"
    :style="blockStyle"
    :data-task-id="task.id"
  >
    <Card
      ref="glass"
      class="task-block__material"
      width="100%"
      height="100%"
      :radius="12"
      :color="simpleMaterial ? currentTask.event?.color ?? undefined : undefined"
      :show-original="detail > 0 && completed"
      :center-glow-color="centerGlowColor"
      aria-hidden="true"
      @color-change="glassColors = $event"
    />
    <span
      v-if="overdue && !completed"
      class="task-block-overdue"
      :style="{ color: overdue === 'due' ? '#ef4444' : '#3b82f6' }"
      :title="overdue === 'due' ? '截止逾期' : '计划逾期'"
      :aria-label="overdue === 'due' ? '截止逾期' : '计划逾期'"
      role="img"
    >
      <Icon
        name="lucide:triangle-alert"
        aria-hidden="true"
      />
    </span>
    <div
      class="task-block-content"
      :aria-hidden="variant !== 'row' && detail > 0 && detail < 3 && completed"
    >
      <slot :text-color="glassColors?.textColor ?? 'var(--text-primary)'">
        <component
          :is="interactive && detail < 3 ? 'button' : 'strong'"
          class="task-block-title"
          :title="currentTask.title"
          :type="interactive && detail < 3 ? 'button' : undefined"
          :aria-label="interactive && detail < 3 ? `查看任务详情：${currentTask.title}` : undefined"
          @click.stop="interactive && detail < 3 && emit('detail', currentTask.id)"
        >
          <slot name="title">
            {{ currentTask.title }}
          </slot>
        </component>
        <p
          v-if="variant !== 'row' && (detail === 3 || !layout.compact) && eventName"
          class="task-block-event"
          :title="eventName"
          :aria-label="`所属事件：${eventName}`"
        >
          {{ eventName }}
        </p>
        <template v-if="detail === 3 && variant !== 'row'">
          <p class="task-block-status">
            {{ statusText }} · 优先级 {{ currentTask.priority }}
          </p>
          <p
            v-if="currentTask.description"
            class="task-block-description"
          >
            {{ currentTask.description }}
          </p>
          <dl class="task-block-dates">
            <template
              v-for="date in taskDates"
              :key="`${date.kind}-${timestamp(date.value)}`"
            >
              <dt>{{ date.label }}</dt>
              <dd>
                <NuxtTime
                  :datetime="date.value!"
                  locale="zh-CN"
                  :time-zone="timeZone"
                  year="numeric"
                  month="2-digit"
                  day="2-digit"
                  hour="2-digit"
                  minute="2-digit"
                  :hour12="false"
                />
              </dd>
            </template>
          </dl>
          <p
            v-if="completed && completionTitle"
            class="task-block-status"
          >
            {{ completionTitle }}
          </p>
          <p
            v-if="currentTask.tags.length"
            class="task-block-tags"
          >
            {{ currentTask.tags.map(tag => `#${tag.name}`).join(' ') }}
          </p>
        </template>
        <ul
          v-if="visibleTips.length"
          class="task-block-tips"
          aria-label="关联提示"
        >
          <li
            v-for="tip in visibleTips"
            :key="tip.id"
            :title="tip.content"
          >
            {{ tip.content }}
          </li>
        </ul>
        <div
          v-if="detail < 3 && hasDateArea"
          class="task-block-end-time"
          :class="{ 'task-block-end-time--double': displayDates.length > 1 }"
        >
          <span
            v-if="planExpired"
            class="task-block-plan-expired"
          >计划逾期</span>
          <div
            v-for="date in displayDates"
            :key="date.kind"
            class="task-block-date-line"
            :title="dateTitle(date)"
          >
            <span class="task-block-time-kind">{{ dateLabel(date) }}</span>
            <NuxtTime
              :datetime="date.value!"
              :aria-label="dateTitle(date)"
              locale="zh-CN"
              :time-zone="timeZone"
              :month="isDisplayDay(date) && !layout.compact ? undefined : '2-digit'"
              :day="isDisplayDay(date) && !layout.compact ? undefined : '2-digit'"
              :hour="layout.compact ? undefined : '2-digit'"
              :minute="layout.compact ? undefined : '2-digit'"
              :hour12="false"
            />
          </div>
        </div>
      </slot>
    </div>
    <div
      v-if="detail > 0 && interactive"
      class="task-block-actions"
    >
      <button
        v-if="editable && mode === 'edit'"
        class="task-block-action task-block-edit"
        type="button"
        :disabled="pending"
        :aria-label="`编辑任务：${currentTask.title}`"
        title="编辑任务"
        @click.stop="emit('edit', currentTask.id)"
      >
        <Icon
          name="lucide:pen-line"
          aria-hidden="true"
        />
      </button>
      <button
        class="task-block-action"
        type="button"
        :disabled="pending"
        :aria-pressed="completed"
        :aria-label="`${completed ? '恢复未完成' : '标记完成'}：${currentTask.title}`"
        :title="`${completed ? '恢复未完成' : '标记完成'}：${currentTask.title}${completed && completionTitle ? `\n${completionTitle}` : ''}`"
        @click.stop="toggleCompleted"
      >
        <Icon
          :name="currentTask.status === 'CANCELLED' ? 'lucide:x' : completed ? 'lucide:check' : 'lucide:circle'"
          aria-hidden="true"
        />
      </button>
      <button
        v-if="canPostpone"
        class="task-block-action"
        type="button"
        :disabled="pending"
        :aria-label="`延期：${currentTask.title}`"
        title="选择延期时间"
        @click.stop="openDefer"
      >
        <Icon
          name="lucide:calendar-clock"
          aria-hidden="true"
        />
      </button>
      <button
        v-if="canCancel"
        class="task-block-action"
        type="button"
        :disabled="pending"
        :aria-label="`放弃：${currentTask.title}`"
        title="放弃"
        @click.stop="cancelTask"
      >
        <Icon
          name="lucide:x"
          aria-hidden="true"
        />
      </button>
    </div>
    <AppPopup
      v-if="detail >= 2 && interactive"
      v-model:open="deferOpen"
      class="task-block__dialog"
      :dismissible="!pending"
      :aria-label="`延期：${currentTask.title}`"
    >
      <form
        class="task-block__defer-form"
        @submit.prevent="saveDefer"
      >
        <strong>延期：{{ currentTask.title }}</strong>
        <p class="muted">
          {{ timeZone }} · {{ currentTask.dueDate ? '请选择截止之前的时间' : '此任务未设置截止时间' }}
        </p>
        <div class="task-block__presets">
          <button
            v-for="preset in deferPresets"
            :key="preset.label"
            class="button"
            type="button"
            :disabled="preset.disabled || pending"
            @click="deferDate = localDateTime(preset.date); deferError = ''"
          >
            {{ preset.label }}
          </button>
        </div>
        <label class="task-block__date-field">
          延期至
          <input
            v-model="deferDate"
            type="datetime-local"
            step="1"
            :min="deferMinimum"
            :max="deferMaximum"
            :disabled="pending"
            required
          >
        </label>
        <p
          v-if="deferError"
          role="alert"
          class="task-block__defer-error"
        >
          {{ deferError }}
        </p>
        <div class="task-block__dialog-actions">
          <button
            class="button"
            type="button"
            :disabled="pending"
            @click="closeDefer"
          >
            取消
          </button>
          <button
            class="button"
            type="submit"
            :disabled="pending"
          >
            {{ pending ? '保存中……' : '确定延期' }}
          </button>
        </div>
      </form>
    </AppPopup>
  </div>
</template>

<style scoped>
.task-block {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: 160px;
  min-width: 0;
  overflow: hidden;
  isolation: isolate;
  border-radius: inherit;
  container-type: size;
  container-name: task;
}
.task-block--detail {
  height: auto;
  overflow: auto;
  container-type: inline-size;
}
.task-block--detail .task-block-content {
  height: auto;
  align-items: stretch;
  justify-content: flex-start;
  padding: 36px 16px 16px;
  gap: 10px;
  background-color: var(--task-detail-backdrop);
  transition: background-color 350ms, opacity 300ms;
}
.task-block--detail .task-block-title {
  display: block;
  font-size: 18px;
}
.task-block--detail .task-block-tips {
  flex-shrink: 0;
}
.task-block--detail .task-block-tips li {
  display: block;
}
.task-block-status,
.task-block-description,
.task-block-tags {
  margin: 0;
  font-size: 13px;
  overflow-wrap: anywhere;
}
.task-block-description {
  white-space: pre-wrap;
}
.task-block-dates {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 6px 10px;
  margin: 0;
  font-size: 12px;
}
.task-block-dates dd {
  margin: 0;
}
.task-block > .task-block__material { position: absolute; inset: 0; pointer-events: none; }
.task-block--completed .task-block-content {
  opacity: 0;
  pointer-events: none;
}
.task-block-overdue {
  position: absolute;
  top: 4px;
  left: 4px;
  z-index: 2;
  display: flex;
  font-size: 18px;
  pointer-events: none;
}
.task-block-actions {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 2;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  max-width: calc(100% - 8px);
  overflow-x: auto;
  scrollbar-width: none;
  gap: 3px;
}
.task-block-action {
  flex: none;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--task-glow) 50%, transparent);
  border-radius: 50%;
  background: color-mix(in srgb, var(--background-secondary) 85%, transparent);
  color: var(--task-glow);
  cursor: pointer;
}
.task-block-action[aria-pressed='true'] { color: var(--background-secondary); background: var(--task-glow); }
.task-block-action:disabled { cursor: wait; opacity: .5; }
.task-block--completed .task-block-action { opacity: .65; }
.task-block-action:hover, .task-block-action:focus-visible { opacity: 1; }
.task-block-content {
  position: relative;
  z-index: 1;
  color: var(--task-foreground, inherit);
  text-shadow: var(--task-text-shadow, none);
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  box-sizing: border-box;
  justify-content: center;
  align-items: center;
  gap: 6px;
  padding: 24px 10px 10px;
  transition: opacity 300ms;
}
.task-block-end-time {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  width: 100%;
  font-size: 11px;
  line-height: 14px;
  text-align: center;
  color: var(--task-foreground, var(--event-color));
  margin-top: auto;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.task-block-end-time--double { flex-direction: column; gap: 2px; }
.task-block-date-line { display: inline-flex; align-items: center; gap: 4px; min-width: 0; white-space: nowrap; }
.task-block-plan-expired { flex: none; color: #3b82f6; }
.task-block-title {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  min-width: 0;
  width: 100%;
  flex-shrink: 0;
  font-size: var(--task-title-size);
  overflow: hidden;
  overflow-wrap: anywhere;
  line-height: 1.25;
  text-align: center;
}
button.task-block-title { padding: 0; border: 0; background: transparent; color: inherit; font-family: inherit; font-weight: 700; text-shadow: inherit; cursor: pointer; }
button.task-block-title:focus-visible { outline: 2px solid currentColor; outline-offset: -2px; border-radius: 4px; }
.task-block-edit { border-radius: 7px; color: var(--text-primary); border-color: var(--border-color); background: var(--background-secondary); }
.task-block-event {
  margin: 0;
  min-width: 0;
  width: 100%;
  flex-shrink: 0;
  font-size: 12px;
  line-height: 17px;
  color: var(--task-foreground, var(--event-color));
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.task-block-tips {
  display: grid;
  width: 100%;
  gap: 4px;
  flex-shrink: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--task-foreground, var(--text-secondary));
  font-size: 11px;
  line-height: 16px;
}
.task-block-tips li {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.task-block--compact .task-block-content {
  gap: 3px;
  padding: 26px 4px 4px;
}
.task-block--compact .task-block-actions { gap: 2px; }
.task-block--compact .task-block-action { width: 18px; height: 18px; font-size: 12px; }
.task-block--preview .task-block-content { padding: 10px; }
.task-block--preview.task-block--compact .task-block-content { padding: 4px; }
.task-block--compact .task-block-end-time {
  width: auto;
  max-width: 100%;
  margin-top: 0;
  font-size: clamp(6px, 11cqi, 9px);
  line-height: 12px;
}
@container task (max-height: 40px) {
  .task-block--compact .task-block-content {
    flex-direction: row;
    gap: 4px;
    padding: 0 calc(var(--task-action-count) * 20px + 6px) 0 4px;
  }
  .task-block-title {
    flex: 1;
    width: auto;
  }
}
@container task (max-height: 24px) {
  .task-block--compact .task-block-content {
    padding: 0 calc(var(--task-action-count) * 20px + 4px) 0 3px;
  }

}
.task-block.task-block--row {
  height: 100%;
  min-height: var(--task-row-min-height, 56px);
}
.task-block--row .task-block-content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  align-items: center;
  gap: 12px;
  padding: 0 calc(var(--task-action-count) * (var(--task-row-action-size) + 3px) + 12px) 0 28px;
}
.task-block--row .task-block-title {
  display: block;
  width: 100%;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}
.task-block--row .task-block-end-time {
  width: clamp(128px, 28cqi, 180px);
  justify-content: flex-end;
  flex-wrap: wrap;
  margin: 0;
  text-align: right;
  font-size: clamp(8px, 32cqb, 12px);
}
.task-block--row .task-block-end-time--double { justify-content: center; align-items: flex-end; }
.task-block-time-kind { margin-right: 4px; }
.task-block--row .task-block-actions {
  top: 50%;
  right: 8px;
  align-items: center;
  transform: translateY(-50%);
}
.task-block--row .task-block-action {
  width: var(--task-row-action-size);
  height: var(--task-row-action-size);
  font-size: clamp(10px, 36cqb, 16px);
}
.task-block--row .task-block-overdue {
  top: 50%;
  left: 8px;
  transform: translateY(-50%);
  font-size: clamp(10px, 36cqb, 16px);
}
.task-block--row.task-block--completed .task-block-content {
  opacity: 1;
  pointer-events: auto;
}
.task-block--row.task-block--completed .task-block-title {
  opacity: .65;
  text-decoration: line-through;
}

@container task (max-width: 360px) {
  .task-block--row .task-block-content {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    padding-top: 4px;
    padding-bottom: var(--task-row-bottom-space);
  }
  .task-block--row .task-block-title {
    display: -webkit-box;
    white-space: normal;
  }
  .task-block--row .task-block-end-time {
    position: absolute;
    right: 8px;
    bottom: 4px;
    left: 8px;
    width: auto;
    text-align: center;
    font-size: 10px;
  }
  .task-block--row .task-block-actions {
    top: 4px;
    transform: none;
  }
}

.task-block__dialog {
  --popup-width: 460px;
  padding: 22px;
}
.task-block__defer-form { display: grid; gap: 14px; }
.task-block__defer-form p { margin: 0; font-size: 13px; }
.task-block__presets, .task-block__dialog-actions { display: flex; flex-wrap: wrap; gap: 7px; }
.task-block__dialog-actions { justify-content: flex-end; }
.task-block__date-field { display: grid; gap: 6px; }
.task-block__date-field input { min-width: 0; padding: 9px; border: 1px solid var(--text-secondary); border-radius: 8px; background: var(--background-primary); color: var(--text-primary); }
.task-block__defer-error { color: #ef4444; }
@media (prefers-reduced-motion: reduce) {
  .task-block-content { transition: none; }
}
</style>
