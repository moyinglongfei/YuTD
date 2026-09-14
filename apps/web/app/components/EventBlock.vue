<script setup lang="ts">
const props = defineProps<{
  top: number
  height: number
  color?: string | null
  eventId: number
  eventName: string
  startTime: string
  endTime: string
  focused?: boolean
}>()

const emit = defineEmits<{
  select: [element: HTMLElement]
}>()

const blockStyle = computed(() => ({
  'top': `${props.top}px`,
  'height': `${props.height}px`,
  '--event-color': props.color ?? '#6366f1'
}))

function handleClick(event: MouseEvent) {
  const element = event.currentTarget

  if (!(element instanceof HTMLElement))
    return

  emit('select', element)
}
</script>

<template>
  <div
    class="event-block"
    :class="{ 'event-block--focused': props.focused }"
    :style="blockStyle"
    :data-event-id="eventId"
    @click.stop="handleClick"
  >
    <div
      class="event-block-corners"
      aria-hidden="true"
    >
      <span class="event-corner event-corner-tl" />
      <span class="event-corner event-corner-tr" />
      <span class="event-corner event-corner-bl" />
      <span class="event-corner event-corner-br" />
    </div>
    <div class="event-block-content">
      <span class="event-block-start-time">
        {{ startTime }}
      </span>
      <strong class="event-block-title">
        {{ eventName }}
      </strong>
      <span class="event-block-end-time">
        {{ endTime }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.event-block {
  position: absolute;
  z-index: 2;
  right: 4px;
  left: 4px;
  box-sizing: border-box;
  overflow: hidden;

  --corner-size: 14px;
  --corner-width: 3px;
}
.event-block--focused {
  z-index: 10;
  background-color: #fff;
  box-shadow: 0 8px 24px rgb(0 0 0 / 15%);
}
/* 事件方框的装饰圆角 */
.event-block-corners {
  position: absolute;
  z-index: 2;
  inset: 0;

  pointer-events: none;
}
.event-corner {
  position: absolute;

  width: var(--corner-size);
  height: var(--corner-size);

  border-color: var(--event-color);
  border-style: solid;
  border-width: 0;
}
.event-corner-tl {
  top: 0;
  left: 0;

  border-top-width: var(--corner-width);
  border-left-width: var(--corner-width);
}
.event-corner-tr {
  top: 0;
  right: 0;

  border-top-width: var(--corner-width);
  border-right-width: var(--corner-width);
}
.event-corner-bl {
  bottom: 0;
  left: 0;

  border-bottom-width: var(--corner-width);
  border-left-width: var(--corner-width);
}
.event-corner-br {
  right: 0;
  bottom: 0;

  border-right-width: var(--corner-width);
  border-bottom-width: var(--corner-width);
}
/* 事件的具体内容 */
.event-block-content {
  display: grid;

  grid-template-rows: auto minmax(20px, 1fr) auto;
  height: 100%;
}
</style>
