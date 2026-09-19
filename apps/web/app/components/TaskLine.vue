<script setup lang="ts">
const props = defineProps<{
  top: number
  kind: 'plan' | 'due'
  taskId?: number
  taskName?: string
  plannedDate?: Date
  dueDate?: Date
}>()

function dateToTimeString(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${hours}:${minutes}`
}
const lineStyle = computed(() => ({
  top: `${props.top}px`
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
  <div class="task">
    <div
      class="task-name"
      :style="lineStyle"
      :title="taskName"
    >
      {{ taskName }}
    </div>

    <div
      class="task-time"
      :style="lineStyle"
    >
      {{ timeText }}
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
  </div>
</template>

<style scoped>
.task-line {
  position: absolute;
  z-index: 5;
  right: 0px;
  left: 0px;
  height: 2px;
  transform: translateY(-1px);
}

.task-name,
.task-time {
  position: absolute;
  z-index: 6;
  left: 3px;
  white-space: nowrap;
  color: #1e3a8a;
}

.task-name {
  z-index: 3;
  right: 3px;
  transform: translateY(calc(-100% - 3px));
  font-size: clamp(8px, 8cqi, 10px);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-time {
  z-index: 3;
  transform: translateY(3px);
  font-size: clamp(8px, 7cqi, 9px);
  font-variant-numeric: tabular-nums;
}

.task-line--plan {
  background-color: #2563eb;
}

.task-line--due {
  background-color: #dc2626;
}
</style>
