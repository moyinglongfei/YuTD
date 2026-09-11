<script setup lang="ts">
const props = defineProps<{
  top: number
  kind: 'plan' | 'due'
  taskId?: number
  taskName?: string
}>()

const lineStyle = computed(() => ({
  top: `${props.top}px`
}))
</script>

<template>
  <div class="task">
    <div
      class="task-name"
      :style="lineStyle"
    >
      {{ taskName }}
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
  z-index: 3;
  right: 6px;
  left: 6px;
  height: 2px;
  transform: translateY(-1px);
}

.task-name {
  position: absolute;
  z-index: 4;
  right: 6px;
  left: 6px;
  transform: translateY(calc(-100% - 3px));
  font-size: 10px;
  color: #1e3a8a;
  text-align: center;
}

.task-line--plan {
  background-color: #2563eb;
}

.task-line--due {
  background-color: #dc2626;
}
</style>
