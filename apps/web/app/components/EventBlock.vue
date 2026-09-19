<script setup lang="ts">
const props = defineProps<{
  top: number
  height: number
  color?: string | null
  eventId: number
  eventName: string
  startTime: string
  endTime: string
  location?: string | null
  organizer?: string | null
  focused?: boolean
  focusProgress?: number
}>()

const emit = defineEmits<{
  select: [element: HTMLElement]
}>()

const progress = computed(() => {
  if (props.focused) {
    return props.focusProgress ?? 0
  } else {
    return 0
  }
})
const blockStyle = computed(() => ({
  'top': `${props.top}px`,
  'height': `${props.height}px`,
  '--event-color': props.color ?? '#6366f1',
  '--event-background-alpha': 0.65 * progress.value + 0.35,
  '--event-blur': `${12 * progress.value}px`,
  '--focus-shadow-alpha': 0.15 * progress.value
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
      <span
        v-if="location"
        class="event-meta event-location"
        :title="location"
      >
        {{ location }}
      </span>

      <span
        v-if="organizer"
        class="event-meta event-organizer"
        :title="organizer"
      >
        {{ organizer }}
      </span>
      <span class="event-block-end-time">
        {{ endTime }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.event-block {
  position: absolute;
  z-index: 4;
  right: 0px;
  left: 0px;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
  overflow: hidden;
  container-type: size;
  container-name: event;
  --corner-size: 14px;
  --corner-width: 3px;
}
.event-block--focused {
  z-index: 4;
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
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
}
.event-block-start-time,
.event-block-end-time {
  left: 0;
  right: 0;
  padding: 1px 0px;
  transform: translateX(3px);
  font-size: clamp(8px, 7cqi, 15px);
  color: var(--event-color);
}
.event-block-end-time {
  margin-top: auto;
  flex-shrink: 0;
}
.event-block-title {
  min-width: 0;
  font-size: clamp(12px, min(10cqi, 30cqb), 20px);
  overflow: hidden;
  overflow-wrap: anywhere;
}
.event-meta {
  overflow: hidden;
  text-overflow: ellipsis;
  display: none;
}
.event-location {
    font-size: clamp(9px, min(16cqi, 16cqb), 15px);
}
.event-organizer {
    font-size: clamp(9px, min(9cqi, 10cqb), 15px);
}
@container event (min-width: 40px) and (min-height: 40px) {
  .event-location {
    display: block;
  }
}

@container event (min-width: 60px) and (min-height: 90px) {
  .event-organizer {
    display: block;
  }
}
</style>
