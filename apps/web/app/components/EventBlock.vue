<script setup lang="ts">
import { computed } from 'vue'

interface EventBlockProps {
  id: number
  name: string
  organizer?: string | null
  location?: string | null
  color?: string | null
  phaseId: number
  weekday: number
  startTime: string
  endTime: string
  weeks: number[]
  createdAt?: Date | string
  updatedAt?: Date | string
  dayStart?: string
  dayEnd?: string
  hourHeight?: number
  columnGap?: number
  minHeight?: number
}

const props = withDefaults(defineProps<EventBlockProps>(), {
  organizer: null,
  location: null,
  color: '#0f766e',
  createdAt: undefined,
  updatedAt: undefined,
  dayStart: '08:00',
  dayEnd: '22:00',
  hourHeight: 72,
  columnGap: 8,
  minHeight: 32
})

function toMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match)
    return null

  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59)
    return null

  return hour * 60 + minute
}

const layout = computed(() => {
  const start = toMinutes(props.startTime)
  const end = toMinutes(props.endTime)
  const dayStart = toMinutes(props.dayStart)
  const dayEnd = toMinutes(props.dayEnd)

  if (start === null || end === null || dayStart === null || dayEnd === null)
    return null
  if (end <= start || dayEnd <= dayStart || props.weekday < 1 || props.weekday > 7)
    return null

  const visibleStart = Math.max(start, dayStart)
  const visibleEnd = Math.min(end, dayEnd)
  if (visibleEnd <= visibleStart)
    return null

  const columnWidth = 100 / 7
  const gap = Math.max(0, props.columnGap)
  const top = (visibleStart - dayStart) / 60 * props.hourHeight
  const availableHeight = (dayEnd - visibleStart) / 60 * props.hourHeight
  const naturalHeight = (visibleEnd - visibleStart) / 60 * props.hourHeight
  const height = Math.min(Math.max(naturalHeight, props.minHeight), availableHeight)

  return {
    durationMinutes: end - start,
    isClipped: start < dayStart || end > dayEnd,
    style: {
      '--event-color': props.color ?? '#0f766e',
      'top': `${top}px`,
      'left': `calc(${(props.weekday - 1) * columnWidth}% + ${gap / 2}px)`,
      'width': `calc(${columnWidth}% - ${gap}px)`,
      'height': `${height}px`
    }
  }
})
</script>

<template>
  <button
    v-if="layout"
    type="button"
    class="event-block absolute z-10 overflow-hidden rounded-lg border px-2.5 py-2 text-left shadow-sm transition duration-150 hover:z-20 hover:-translate-y-0.5 hover:shadow-md focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--event-color)"
    :style="layout.style"
    :aria-label="`${name}，${startTime} 至 ${endTime}${location ? `，${location}` : ''}`"
    :data-event-id="id"
    :data-phase-id="phaseId"
    :data-weekday="weekday"
    :data-clipped="layout.isClipped || undefined"
  >
    <slot
      :duration-minutes="layout.durationMinutes"
      :is-clipped="layout.isClipped"
    >
      <span class="block truncate text-sm font-semibold leading-tight text-slate-900">
        {{ name }}
      </span>
      <span class="mt-1 block truncate text-xs font-medium text-slate-700">
        {{ startTime }}–{{ endTime }}
      </span>
      <span
        v-if="location && layout.durationMinutes >= 60"
        class="mt-1 block truncate text-xs text-slate-600"
      >
        {{ location }}
      </span>
    </slot>
  </button>
</template>

<style scoped>
.event-block {
  border-color: color-mix(in srgb, var(--event-color) 48%, white);
  background: color-mix(in srgb, var(--event-color) 18%, white);
  box-shadow: inset 3px 0 0 var(--event-color), 0 3px 12px rgb(15 23 42 / 8%);
}
</style>
