<script setup lang="ts">
import TaskBlock from '~/components/preview/Task/TaskBlock.vue'
import AppPopup from '~/components/common/AppPopup.vue'
import BackgroundLayout from '~/components/image/BackgroundLayout.vue'
import { BackgroundContextKey } from '~/components/image/background'
import { GlassLayerKey } from '~/components/preview/card/glass/edges'

const props = defineProps<{
  top: number
  kind: 'plan' | 'due'
  covered?: boolean
  markerOffset?: number
  taskId?: number
  taskName?: string
  plannedDate?: Date
  dueDate?: Date
  task?: ApiData<Api['api']['task']['get']>[number]
}>()

const popoverId = useId()
const background = inject(BackgroundContextKey, null)
const glassLayer = inject(GlassLayerKey, null)
const { timeZone } = useSystemTime()
const anchor = ref<HTMLButtonElement | null>(null)
const opened = ref(false)

function dateToTimeString(date: Date): string {
  const parts = clockParts(date, timeZone.value)
  const hours = String(parts.hour).padStart(2, '0')
  const minutes = String(parts.minute).padStart(2, '0')

  return `${hours}:${minutes}`
}
const lineStyle = computed(() => ({
  top: `${props.top}px`
}))
const labelStyle = computed(() => ({ top: `${props.top}px` }))
const markerStyle = computed(() => ({
  top: `${props.top}px`,
  right: `calc(3px + ${(props.markerOffset ?? 0) / 18} * var(--task-marker-size))`
}))
const timeText = computed(() => {
  if (props.kind === 'plan' && props.plannedDate) {
    return dateToTimeString(props.plannedDate)
  } else if (props.kind === 'due' && props.dueDate) {
    return dateToTimeString(props.dueDate)
  } else {
    return ''
  }
})
</script>

<template>
  <div
    class="task"
    :style="{ '--task-line-color': kind === 'plan' ? '#2563eb' : '#dc2626' }"
  >
    <button
      v-if="task"
      ref="anchor"
      type="button"
      :class="covered ? 'task-marker' : 'task-label'"
      :style="covered ? markerStyle : labelStyle"
      :aria-controls="popoverId"
      :aria-expanded="opened"
      aria-haspopup="dialog"
      :title="timeText + ' ' + taskName"
      :aria-label="timeText + ' ' + taskName + '，查看任务详情'"
      @click.stop="opened = !opened"
    >
      <span
        class="task-marker__triangle"
        aria-hidden="true"
      />
      <template v-if="!covered">
        <span class="task-label__name">{{ taskName }}</span>
        <span class="task-label__time">{{ timeText }}</span>
      </template>
    </button>
    <div
      v-else-if="!covered"
      class="task-label"
      :style="labelStyle"
      :title="taskName"
    >
      <span
        class="task-marker__triangle"
        aria-hidden="true"
      />
      <span class="task-label__name">{{ taskName }}</span>
      <span class="task-label__time">{{ timeText }}</span>
    </div>
    <div
      class="task-line"
      :class="{
        'task-line--plan': kind === 'plan',
        'task-line--due': kind === 'due'
      }"
      :style="lineStyle"
      :data-task-id="taskId"
    />
    <AppPopup
      v-if="task"
      :id="popoverId"
      v-model:open="opened"
      mode="popover"
      :anchor="anchor"
      :aria-label="task.title"
      class="task-popover"
    >
      <BackgroundLayout
        v-if="background"
        class="task-popover__background"
        :image="background.src.value"
        :simplified-image="glassLayer?.image.value"
        :analysis="glassLayer?.analysis.value"
      >
        <TaskBlock
          :task="task"
          :detail="3"
        />
      </BackgroundLayout>
      <TaskBlock
        v-else
        :task="task"
        :detail="3"
      />
    </AppPopup>
  </div>
</template>

<style scoped>
.task { --task-marker-size: 18px; }

.task-line {
  position: absolute;
  z-index: 5;
  right: 0px;
  left: 0px;
  height: 2px;
  transform: translateY(-1px);
  background-color: var(--task-line-color);
  pointer-events: none;
}

.task-label {
  position: absolute;
  z-index: 6;
  left: 3px;
  right: 3px;
  height: 0;
  overflow: visible;
  padding: 0;
  border: 0;
  font-family: inherit;
  font-size: clamp(8px, 8cqi, 10px);
  background: transparent;
  white-space: nowrap;
}
button.task-label {
  cursor: pointer;
}
.task-label__name,
.task-label__time {
  position: absolute;
  display: block;
  padding: 1px 3px;
  border-radius: 3px;
  color: white;
  background: rgb(0 0 0 / 40%);
  text-shadow: 0 1px 2px rgb(0 0 0 / 50%);
}
.task-label__name {
  top: -22px;
  right: 0;
  left: 0;
  height: 20px;
  line-height: 18px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}
.task-label__time {
  top: 3px;
  right: 0;
  height: 14px;
  line-height: 12px;
  font-size: clamp(8px, 7cqi, 9px);
  font-variant-numeric: tabular-nums;
}
.task-label:focus-visible .task-label__name {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}
.task-label > .task-marker__triangle { display: none; }
.task-marker {
  position: absolute;
  z-index: 7;
  display: grid;
  place-items: center;
  width: var(--task-marker-size);
  height: var(--task-marker-size);
  padding: 2px;
  border: 0;
  background: transparent;
  transform: translateY(-50%);
  filter: drop-shadow(0 0 3px var(--task-line-color)) drop-shadow(0 0 1px white);
  cursor: pointer;
}
.task-marker__triangle {
  width: 100%;
  height: 100%;
  background: var(--task-line-color);
  clip-path: polygon(0 0, 100% 50%, 0 100%);
}

@container schedule (width < 480px) {
  .task { --task-marker-size: 14px; }
}

@container schedule-day (width < 45px) {
  .task { --task-marker-size: 10px; }
  .task-label {
    z-index: 7;
    left: auto;
    display: grid;
    place-items: center;
    width: var(--task-marker-size);
    height: var(--task-marker-size);
    padding: 2px;
    transform: translateY(-50%);
    filter: drop-shadow(0 0 3px var(--task-line-color)) drop-shadow(0 0 1px white);
  }
  .task-label > .task-marker__triangle { display: block; }
  .task-label__name,
  .task-label__time { display: none; }
}

.task-popover__background {
  height: auto;
}
</style>
