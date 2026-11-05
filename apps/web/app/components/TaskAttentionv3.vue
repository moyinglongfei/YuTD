<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { gsap } from 'gsap'
import MosaicLayout from '~/components/common/MosaicLayout.vue'
import TaskBlock from '~/components/preview/Task/TaskBlock.vue'
import BackgroundSelect from '~/components/image/BackgroundSelect.vue'
import Background from '~/components/image/BackgroundLayout.vue'
import type { BackgroundSelection } from '~/components/image/BackgroundSelect.vue'
import type { MosaicItem } from '~/utils/orderedTreemap'

type Task = ApiData<Api['api']['task']['get']>[number]
const TaskEditPopup = defineAsyncComponent(() => import('./edit/TaskEditPopup.vue'))
const selectedTask = shallowRef<Task | null>(null)
type Tile = MosaicItem & { task: Task }

const props = withDefaults(defineProps<{
  phaseId?: number
  date?: string
  backgroundImage?: string
}>(), { backgroundImage: '/images/bg.png' })
const emit = defineEmits<{ 'task-hover': [taskId: number | null] }>()
const phaseId = toRef(props, 'phaseId')
const { now, timeZone } = useSystemTime()
const period = ref<'daily' | 'weekly'>('daily')
const selectedDate = ref<Date | null>(null)
const selectedWeek = ref(0)
const phaseClient = useApi({
  key: () => `taskAttention:v3:phase:${phaseId.value ?? 'none'}`,
  read: async api => phaseId.value === undefined
    ? null
    : api.api.phase({ id: phaseId.value }).get()
})
const phaseState = useAsyncData(phaseClient.key, phaseClient.read, { deep: true })
const phase = computed(() => phaseState.data.value?.id === phaseId.value ? phaseState.data.value : null)
const startDay = computed(() => phase.value ? new Date(phase.value.startDate).toISOString().slice(0, 10) : '')
const endDay = computed(() => phase.value ? new Date(phase.value.endDate).toISOString().slice(0, 10) : '')
const selectedDay = computed(() => selectedDate.value ? calendarDate(selectedDate.value, timeZone.value) : '')

watch([phaseId, () => props.date], () => {
  period.value = 'daily'
  selectedDate.value = null
  selectedWeek.value = 0
}, { flush: 'sync' })
watch([now, phase, () => props.date], ([date]) => {
  if (selectedDate.value || (!date && !props.date) || (phaseId.value !== undefined && !phase.value)) return
  let day = props.date || calendarDate(date!, timeZone.value)
  if (phase.value) day = day < startDay.value ? startDay.value : day > endDay.value ? endDay.value : day
  selectedDate.value = parseZonedDateTime(day, timeZone.value, 'compatible')
  selectedWeek.value = phase.value ? Math.floor((calendarDayNumber(day) - calendarDayNumber(startDay.value)) / 7) + 1 : 0
}, { immediate: true })

const ready = computed(() => Boolean(selectedDay.value)
  && (phaseId.value === undefined || Boolean(phase.value))
  && (period.value === 'daily' || Boolean(phase.value && selectedWeek.value)))
const requestKey = computed(() => {
  const selection = ready.value ? (period.value === 'daily' ? selectedDay.value : selectedWeek.value) : 'pending'
  return `taskAttention:v3:${phaseId.value ?? 'all'}:${period.value}:${selection}:${timeZone.value}`
})
const tasksClient = useApi({
  key: () => requestKey.value,
  read: async api => !ready.value
    ? null
    : period.value === 'daily'
      ? api.api.dailytask.get({ query: { phase: phaseId.value, date: selectedDay.value } })
      : api.api.weeklytask.get({ query: { phase: phaseId.value, weekNumber: selectedWeek.value } }),
  write: (api, selection: { period: 'daily' | 'weekly', phase?: number, date: string, weekNumber: number, cleared: 0 | 1 }) => selection.period === 'daily'
    ? api.api.dailytask.patch({ cleared: selection.cleared }, { query: { phase: selection.phase, date: selection.date } })
    : api.api.weeklytask.patch({ cleared: selection.cleared }, { query: { phase: selection.phase, weekNumber: selection.weekNumber } })
})
const taskState = useAsyncData(tasksClient.key, tasksClient.read, { deep: true })
const { data } = taskState
const loading = computed(() => phaseState.pending.value || taskState.pending.value)
async function refresh() {
  if (phaseId.value !== undefined && !phase.value) await phaseState.refresh()
  await taskState.refresh()
}
async function setCleared(cleared: 0 | 1) {
  if (!ready.value) return
  const key = requestKey.value
  const result = await tasksClient.write({
    period: period.value, phase: phaseId.value, date: selectedDay.value, weekNumber: selectedWeek.value, cleared
  })
  if (key === requestKey.value) data.value = result
}
function dateMove(num: number) {
  if (!selectedDate.value || loading.value || saving.value) return
  const day = addCalendarDays(selectedDay.value, num)
  if (phase.value && (day < startDay.value || day > endDay.value)) return
  selectedDate.value = parseZonedDateTime(day, timeZone.value, 'compatible')
}
function weekMove(num: number) {
  if (!phase.value || !selectedWeek.value || loading.value || saving.value) return
  const week = selectedWeek.value + num
  if (week < 1 || week > phase.value.weekCount) return
  selectedWeek.value = week
}
const attentionDate = computed(() => period.value === 'daily'
  ? selectedDay.value
  : phase.value ? addCalendarDays(startDay.value, (selectedWeek.value - 1) * 7) : '')
const tasks = computed(() => data.value?.tasks ?? [])
const pendingTasks = useState<Record<number, boolean>>('tasks:completion-pending', () => ({}))
const isFinished = (task: Task) => task.completed || task.status === 'DONE' || task.status === 'CANCELLED'
const timestamp = (value: Task['plannedDate']) => value ? new Date(value).getTime() : NaN
function overdue(task: Task) {
  if (isFinished(task) || !now.value) return
  if (timestamp(task.dueDate) < now.value.getTime()) return 'due'
  if (timestamp(task.plannedDate) < now.value.getTime()) return 'plan'
}
function taskCenterGlow(task: Task) {
  const onDay = (value: Task['plannedDate']) => value && calendarDate(value, timeZone.value) === attentionDate.value
  if (onDay(task.dueDate)) return 'rgb(239 68 68 / .22)'
  if (onDay(task.plannedDate)) return 'rgb(59 130 246 / .22)'
}
const tiles = computed<Tile[]>(() => tasks.value.map(task => ({
  id: task.id, weight: Math.max(1, task.priority), task
})))
const allDone = computed(() => tasks.value.length > 0 && Boolean(data.value?.allDone))
const revealing = ref(false)
const cleared = computed<boolean>(previous => data.value
  ? data.value.cleared === 1 || tasks.value.length === 0
  : previous ?? false)
const clearLabel = computed(() => period.value === 'daily' ? '清空今日任务' : '清空本周任务')
const taskSummary = computed<string>((previous) => {
  if (!data.value) return previous ?? ''
  const periodLabel = period.value === 'daily' ? '今天有' : '本周有'
  return tasks.value.length ? `${periodLabel} ${tasks.value.length} 项任务` : `${periodLabel}没有任务`
})
const changingState = ref(false)
const saving = computed(() => changingState.value || tasks.value.some(task => pendingTasks.value[task.id]))
const confirmStage = ref<HTMLElement | null>(null)
const holdState = ref<'idle' | 'charging' | 'returning' | 'revealing'>('idle')
const holdMotion = ref({ progress: 0 })
const revealProgress = ref(0)
const revealMode = ref<0 | 1>(0)
const revealViewport = ref({ width: 0, height: 0 })
const revealMaskId = useId()
const revealRadius = computed(() => Math.hypot(revealViewport.value.width, revealViewport.value.height)
  * (revealMode.value === 0 ? revealProgress.value : 1 - revealProgress.value))
let holdAnimation: gsap.core.Tween | undefined
function resetHold() {
  holdAnimation?.kill()
  holdAnimation = undefined
  holdState.value = 'idle'
  holdMotion.value.progress = 0
}
function releaseHold() {
  if (holdState.value !== 'charging') return
  holdAnimation?.kill()
  holdState.value = 'returning'
  holdAnimation = gsap.to(holdMotion.value, {
    progress: 0, duration: 1, ease: 'none',
    onComplete: () => {
      holdAnimation = undefined
      holdState.value = 'idle'
    }
  })
}
function finishReveal() {
  if (holdState.value !== 'revealing' || revealProgress.value < 1 || changingState.value) return
  revealing.value = false
  revealMode.value = revealMode.value === 0 ? 1 : 0
  resetHold()
  stopLayout()
}
function beginHold() {
  if (!ready.value || !allDone.value || cleared.value || saving.value || holdState.value === 'charging' || holdState.value === 'revealing') return
  holdAnimation?.kill()
  holdState.value = 'charging'
  holdAnimation = gsap.to(holdMotion.value, {
    progress: 1, duration: 1, ease: 'expo.out', onComplete: () => { void confirmCompleted() }
  })
}
function startPointerHold(event: PointerEvent) {
  if (event.button !== 0 || !event.isPrimary || saving.value || holdState.value === 'charging' || holdState.value === 'revealing') return
  event.preventDefault()
  const button = event.currentTarget as HTMLButtonElement
  button.focus()
  button.setPointerCapture(event.pointerId)
  beginHold()
}
function startKeyHold(event: KeyboardEvent) {
  if (!event.repeat) beginHold()
}
async function confirmCompleted() {
  if (!ready.value || !allDone.value || saving.value) return
  holdState.value = 'revealing'
  revealing.value = true
  revealProgress.value = 0
  revealViewport.value = { width: confirmStage.value?.clientWidth ?? 64, height: confirmStage.value?.clientHeight ?? 64 }
  holdAnimation = gsap.to(revealProgress, { value: 1, duration: 1, ease: 'expo.out', onComplete: finishReveal })
  changingState.value = true
  try {
    await setCleared(1)
  } catch {
    revealing.value = false
    resetHold()
  } finally {
    changingState.value = false
    finishReveal()
  }
}
async function reopen() {
  if (!ready.value || !tasks.value.length || saving.value || holdState.value === 'revealing') return
  changingState.value = true
  try {
    await setCleared(0)
  } catch {
    // useApi 已统一上报，保留当前画面。
  } finally {
    changingState.value = false
  }
}

const backgroundSelection = shallowRef<BackgroundSelection | null>(null)
const backgroundPending = ref(true)
const backgroundKey = computed(() => ready.value
  ? `task-attention:${phaseId.value ?? 'all'}:${period.value}:${attentionDate.value}`
  : undefined)

const glassTiles = new Map<string | number, { updateRect: () => void }>()
const movingTiles = shallowReactive(new Map<Element, Set<string>>())
let layoutFrame = 0
function setGlassTile(key: string | number, instance: unknown) {
  if (instance) glassTiles.set(key, instance as { updateRect: () => void })
  else glassTiles.delete(key)
}
function trackLayout(event: TransitionEvent) {
  const tile = event.target
  if (!(tile instanceof Element) || !tile.classList.contains('mosaic-layout__tile') || !['left', 'top', 'width', 'height'].includes(event.propertyName)) return
  if (event.type === 'transitionrun') {
    const properties = movingTiles.get(tile) ?? new Set<string>()
    properties.add(event.propertyName)
    movingTiles.set(tile, properties)
  } else {
    const properties = movingTiles.get(tile)
    properties?.delete(event.propertyName)
    if (!properties?.size) movingTiles.delete(tile)
  }
  if (layoutFrame) return
  const follow = () => {
    layoutFrame = 0
    for (const glass of glassTiles.values()) glass.updateRect()
    for (const tile of movingTiles.keys()) if (!tile.isConnected) movingTiles.delete(tile)
    if (movingTiles.size) layoutFrame = requestAnimationFrame(follow)
  }
  layoutFrame = requestAnimationFrame(follow)
}
function stopLayout() {
  cancelAnimationFrame(layoutFrame)
  layoutFrame = 0
  movingTiles.clear()
}
watch([requestKey, period, () => props.phaseId, timeZone], () => {
  resetHold()
  stopLayout()
  revealing.value = false
})
watch(saving, (value) => {
  if (value && (holdState.value === 'charging' || holdState.value === 'returning')) resetHold()
})
watch([allDone, cleared], () => {
  if (cleared.value) stopLayout()
  if (!allDone.value) revealing.value = false
  if (!allDone.value || (cleared.value && !revealing.value)) resetHold()
})
onBeforeUnmount(() => {
  resetHold()
  stopLayout()
})
</script>

<template>
  <section
    class="task-attention"
    aria-label="关注任务"
  >
    <header class="task-attention__header">
      <div
        class="task-attention__periods"
        role="group"
        aria-label="任务时间范围"
      >
        <button
          class="button"
          type="button"
          :aria-pressed="period === 'daily'"
          :disabled="saving"
          @click="period = 'daily'"
        >
          日
        </button>
        <button
          class="button"
          type="button"
          :aria-pressed="period === 'weekly'"
          :disabled="loading || saving || !phase"
          @click="period = 'weekly'"
        >
          周
        </button>
      </div>
      <div
        v-if="period === 'daily'"
        class="task-attention__date-picker"
      >
        <button
          class="button"
          type="button"
          aria-label="上一日"
          :disabled="loading || saving || !selectedDay || Boolean(phase && selectedDay <= startDay)"
          @click="dateMove(-1)"
        >
          <Icon name="lucide:chevron-left" />
        </button>
        {{ selectedDay }}
        <button
          class="button"
          type="button"
          aria-label="下一日"
          :disabled="loading || saving || !selectedDay || Boolean(phase && selectedDay >= endDay)"
          @click="dateMove(1)"
        >
          <Icon name="lucide:chevron-right" />
        </button>
      </div>
      <div
        v-else
        class="task-attention__date-picker"
      >
        <button
          class="button"
          type="button"
          aria-label="上一周"
          :disabled="loading || saving || !phase || selectedWeek <= 1"
          @click="weekMove(-1)"
        >
          <Icon name="lucide:chevron-left" />
        </button>
        <span>第</span>
        {{ selectedWeek }}
        <span>周</span>
        <button
          class="button"
          type="button"
          aria-label="下一周"
          :disabled="loading || saving || !phase || selectedWeek >= phase.weekCount"
          @click="weekMove(1)"
        >
          <Icon name="lucide:chevron-right" />
        </button>
      </div>
      <div class="task-attention__tools">
        <button
          type="button"
          class="button task-attention__refresh"
          aria-label="刷新任务"
          title="刷新任务"
          :disabled="loading || saving"
          @click="refresh()"
        >
          <Icon
            name="lucide:refresh-cw"
            aria-hidden="true"
          />
        </button>
      </div>
    </header>
    <!-- 按日期或周恢复后端绑定；首次从乱序轮播队列选择。 -->
    <BackgroundSelect
      hide-selection
      :background-key="backgroundKey"
      random
      @change="backgroundSelection = $event"
      @loading-change="backgroundPending = $event"
    />
    <Background
      class="task-attention__background"
      :pending="backgroundPending"
      :image="backgroundSelection?.image ?? backgroundImage"
      :position="backgroundSelection?.position"
      :simplified-image="backgroundSelection?.simplifiedImage"
      :analysis="backgroundSelection?.analysis"
    >
      <p
        v-if="!selectedDate && !phaseState.error.value"
        class="task-attention__message"
        role="status"
      >
        正在确认日期……
      </p>
      <p
        v-else-if="!data"
        class="task-attention__message"
        role="status"
      >
        {{ loading ? '正在加载关注任务……' : '关注任务尚未载入，请重新加载。' }}
      </p>
      <MosaicLayout
        v-else-if="!cleared || revealing"
        class="task-attention__mosaic"
        :items="tiles"
        :gap="7"
        fixed="both"
        :aspect-preference-strength="0.3"
        @transitionrun="trackLayout"
        @transitionend="trackLayout"
        @transitioncancel="trackLayout"
      >
        <template #default="{ item }">
          <TaskBlock
            :ref="instance => setGlassTile(item.id, instance)"
            class="task-attention__block"
            :task="item.task"
            :overdue="overdue(item.task)"
            :center-glow-color="taskCenterGlow(item.task)"
            :detail="period === 'weekly' ? 1 : 2"
            @detail="selectedTask = item.task"
            @change="refresh()"
            @mouseenter="emit('task-hover', item.task.id)"
            @mouseleave="emit('task-hover', null)"
          />
        </template>
      </MosaicLayout>
      <div
        v-if="allDone && (!cleared || revealing)"
        ref="confirmStage"
        class="task-attention__confirmation"
      >
        <button
          class="task-attention__confirm"
          type="button"
          :title="`长按${clearLabel}`"
          :aria-label="`长按${clearLabel}`"
          :aria-busy="holdState !== 'idle' || saving"
          :disabled="saving"
          @pointerdown="startPointerHold"
          @pointerup="releaseHold"
          @pointercancel="releaseHold"
          @lostpointercapture="releaseHold"
          @keydown.space.prevent="startKeyHold"
          @keydown.enter.prevent="startKeyHold"
          @keyup.space.prevent="releaseHold"
          @keyup.enter.prevent="releaseHold"
          @blur="releaseHold"
          @contextmenu.prevent
        >
          <span
            class="task-attention__confirm-glow"
            :style="{ opacity: 0.3 + holdMotion.progress * 0.7, transform: `scale(${1 + holdMotion.progress})` }"
            aria-hidden="true"
          />
          <svg
            class="task-attention__confirm-icon"
            :style="{ transform: `scale(${1 + holdMotion.progress * 0.2})` }"
            viewBox="0 0 64 64"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path
              class="task-attention__confirm-track"
              d="M 32 4 L 56 46 L 8 46 Z"
              stroke-width="2"
            />
            <path
              d="M 32 4 L 56 46 L 8 46 Z"
              :opacity="holdMotion.progress > 0 ? 1 : 0"
              stroke-width="3"
              pathLength="100"
              stroke-dasharray="100"
              :stroke-dashoffset="100 * (1 - holdMotion.progress)"
            />
          </svg>
        </button>
      </div>
      <svg
        v-if="revealing"
        class="task-attention__mask"
        aria-hidden="true"
      >
        <defs>
          <mask
            :id="revealMaskId"
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            :width="revealViewport.width"
            :height="revealViewport.height"
            style="mask-type: luminance"
          >
            <rect
              :width="revealViewport.width"
              :height="revealViewport.height"
              :fill="revealMode === 0 ? 'black' : 'white'"
            />
            <circle
              cx="0"
              :cy="revealViewport.height"
              :r="revealRadius"
              :fill="revealMode === 0 ? 'white' : 'black'"
            />
          </mask>
        </defs>
      </svg>
      <Background
        v-show="cleared || revealing"
        class="task-attention__full-image"
        :pending="backgroundPending"
        :style="{ mask: revealing && revealProgress < 1 ? `url(#${revealMaskId})` : undefined }"
        :image="backgroundSelection?.image ?? backgroundImage"
        :simplified-image="backgroundSelection?.simplifiedImage"
        :position="backgroundSelection?.position"
      >
        <p
          class="task-attention__summary"
          role="status"
        >
          {{ taskSummary }}
        </p>
        <button
          v-if="tasks.length"
          type="button"
          class="button task-attention__reopen"
          :disabled="saving || holdState === 'revealing'"
          @click="reopen"
        >
          查看任务
        </button>
      </Background>
    </Background>
    <TaskEditPopup
      v-if="selectedTask"
      :task="selectedTask"
      :phase-id="selectedTask.phaseId"
      :open="true"
      :background="backgroundSelection"
      @update:open="!$event && (selectedTask = null)"
      @saved="refresh()"
      @change="refresh()"
    />
  </section>
</template>

<style scoped>
.task-attention {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  container-type: inline-size;
}

.task-attention__header,
.task-attention__periods,
.task-attention__date-picker,
.task-attention__tools {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
}

.task-attention__header {
  flex: none;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  margin-bottom: 7px;
}

.task-attention__tools {
  justify-self: end;
}

.task-attention__periods [aria-pressed='true'] {
  color: var(--background-secondary);
  background: var(--text-primary);
  border-color: var(--text-primary);
}

.task-attention > .task-attention__background {
  flex: 1;
  min-height: 0;
  border-radius: 12px;
  background: var(--background-secondary);
}

.task-attention__background > :deep(.background-layout__image) {
  visibility: hidden;
}

.task-attention__block {
  height: 100%;
}

.task-attention__confirmation {
  position: absolute;
  inset: 0;
  z-index: 2;
  overflow: hidden;
  clip-path: inset(0 round 12px);
  pointer-events: none;
}
.task-attention__confirm {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  padding: 8px;
  border: 0;
  border-radius: 50%;
  color: var(--accent-color);
  background: transparent;
  pointer-events: auto;
  cursor: pointer;
  touch-action: none;
  user-select: none;
  transform: translate(-50%, -50%);
}
.task-attention__confirm-icon {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: visible;
  transform-origin: center;
  filter: drop-shadow(0 0 6px var(--accent-color));
}
.task-attention__confirm-glow {
  position: absolute;
  inset: -20px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--accent-color), transparent 70%);
  filter: blur(12px);
  pointer-events: none;
}
.task-attention__confirm-track { opacity: .35; }
.task-attention__confirm:disabled {
  cursor: wait;
}
.task-attention__confirm:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 4px;
}
.task-attention__mask {
  position: absolute;
  width: 0;
  height: 0;
  pointer-events: none;
}
.task-attention__summary {
  position: absolute;
  top: 12px;
  left: 12px;
  margin: 0;
  padding: 4px 8px;
  border-radius: 6px;
  color: #fff;
  background: rgb(0 0 0 / .28);
  font-size: 12px;
  pointer-events: none;
}

.task-attention__message {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 12px;
  gap: 10px;
  color: var(--text-primary);
}

.task-attention__message strong {
  padding: 8px 16px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--background-secondary) 82%, transparent);
}
.task-attention__background :deep(.background-layout__content) {
  position: relative;
}
.task-attention__background .task-attention__full-image {
  position: absolute;
  inset: 0;
  z-index: 3;
}
.task-attention__full-image :deep(.background-layout__image) {
  visibility: visible;
}
.task-attention__reopen {
  position: absolute;
  right: 12px;
  bottom: 12px;
}
.task-attention__date-picker {
  justify-content: center;
  max-width: 250px;
}
.task-attention__periods {
  justify-self: start;
}
.task-attention__refresh {
  width: 32px;
  min-height: 32px;
  padding: 5px;
}
@container (max-width: 480px) {
  .task-attention__header {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .task-attention__date-picker {
    grid-column: 1 / -1;
    grid-row: 2;
    justify-self: center;
  }
  .task-attention__tools {
    grid-column: 2;
    grid-row: 1;
  }
}
</style>
