<script setup lang="ts">
const props = withDefaults(defineProps<{
  count?: number
  modelValue?: number[]
  selectable?: boolean
  exclusive?: boolean
  color?: string | null
}>(), {
  count: 0,
  modelValue: () => [],
  selectable: false,
  exclusive: false,
  color: null
})

const emit = defineEmits<{
  'update:modelValue': [weeks: number[]]
}>()
const picker = ref<HTMLDivElement | null>(null)
let painting: { pointerId: number, visited: Set<number>, selected: Set<number>, x: number, y: number } | null = null
let ignoreClick = false

function stopPainting(event?: PointerEvent) {
  if (!painting || (event && event.pointerId !== painting.pointerId)) return
  painting = null
  document.removeEventListener('pointermove', movePainting)
  document.removeEventListener('pointerup', stopPainting)
  document.removeEventListener('pointercancel', stopPainting)
  window.removeEventListener('blur', cancelPainting)
}

function cancelPainting() {
  stopPainting()
}

function paint(weeks: number[]) {
  if (!painting) return
  for (const week of weeks) {
    if (props.exclusive) {
      painting.selected = new Set([week])
      continue
    }
    if (painting.visited.has(week)) continue
    painting.visited.add(week)
    if (painting.selected.has(week)) painting.selected.delete(week)
    else painting.selected.add(week)
  }
  emit('update:modelValue', [...painting.selected].sort((a, b) => a - b))
}

function startPainting(weeks: number[], event: PointerEvent) {
  if (!props.selectable || !event.isPrimary || event.button !== 0 || painting) return
  event.preventDefault()
  stopPainting()
  ignoreClick = true
  painting = { pointerId: event.pointerId, visited: new Set(), selected: new Set(props.modelValue), x: event.clientX, y: event.clientY }
  document.addEventListener('pointermove', movePainting)
  document.addEventListener('pointerup', stopPainting)
  document.addEventListener('pointercancel', stopPainting)
  window.addEventListener('blur', cancelPainting)
  paint(weeks)
}

function movePainting(event: PointerEvent) {
  if (!painting || painting.pointerId !== event.pointerId) return
  if (!(event.buttons & 1)) {
    stopPainting()
    return
  }
  const { x, y } = painting
  const dx = event.clientX - x
  const dy = event.clientY - y
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 8))
  painting.x = event.clientX
  painting.y = event.clientY

  // 补采两次事件之间的路径，快速划过也不会漏掉中间的周。
  for (let step = 1; step <= steps; step++) {
    const item = document.elementFromPoint(x + dx * step / steps, y + dy * step / steps)
      ?.closest<HTMLButtonElement>('[data-week]')
    if (!item || !picker.value?.contains(item)) continue
    const week = Number(item.dataset.week)
    if (props.exclusive ? painting.selected.has(week) : painting.visited.has(week)) continue
    paint([week])
  }
}

function clickWeek(weeks: number[], event?: MouseEvent) {
  if (ignoreClick && event && event.detail !== 0) {
    ignoreClick = false
    return
  }
  ignoreClick = false
  toggle(weeks)
}

watch([() => props.selectable, () => props.count, () => props.exclusive], cancelPainting)
onBeforeUnmount(cancelPainting)

// 最小合并周长度（包含）
const minMergeLength = 3

interface WeekGroup {
  key: string
  label: string
  weeks: number[]
  selected: boolean
  merged: boolean
}

// 相邻 minMergeLength 以上、奇数或偶数 minMergeLength 以上进行合并
function mergeWeeks(weeks: number[]) {
  const list: WeekGroup[] = []
  let run: number[] = []
  let step = 0

  function flush() {
    if (!run.length)
      return

    const first = run[0]
    const last = run[run.length - 1]

    if (first === undefined || last === undefined)
      return

    if (run.length >= minMergeLength && step > 0) {
      const prefix = step === 2 ? (first % 2 === 1 ? '奇' : '偶') : ''

      list.push({
        key: `${first}-${last}`,
        label: `${prefix}${first}-${last}`,
        weeks: [...run],
        selected: true,
        merged: true
      })
    } else {
      for (const week of run) {
        list.push({
          key: `${week}`,
          label: `${week}`,
          weeks: [week],
          selected: true,
          merged: false
        })
      }
    }

    run = []
    step = 0
  }

  for (const week of weeks) {
    const previous = run.at(-1)

    if (previous !== undefined) {
      const gap = week - previous

      if (gap <= 2 && (step === 0 || step === gap))
        step = gap
      else
        flush()
    }

    run.push(week)
  }

  flush()

  return list
}

const groups = computed<WeekGroup[]>(() => {
  if (props.selectable) {
    return Array.from(
      { length: Math.max(0, props.count) },
      (_, index) => index + 1
    ).map(week => ({
      key: `${week}`,
      label: `${week}`,
      weeks: [week],
      selected: props.exclusive ? props.modelValue[0] === week : props.modelValue.includes(week),
      merged: false
    }))
  }

  const weeks = [...new Set(props.exclusive ? props.modelValue.slice(0, 1) : props.modelValue)]
    .filter(week => Number.isInteger(week) && week > 0)
    .sort((a, b) => a - b)

  return mergeWeeks(weeks)
})

function groupTitle(weeks: number[]) {
  return `第${weeks.join('、')}周`
}

function toggle(weeks: number[]) {
  if (!props.selectable)
    return

  if (props.exclusive) {
    if (weeks[0] !== undefined) emit('update:modelValue', [weeks[0]])
    return
  }

  const selected = new Set(props.modelValue)
  const allSelected = weeks.every(week => selected.has(week))

  for (const week of weeks) {
    if (allSelected)
      selected.delete(week)
    else
      selected.add(week)
  }

  emit('update:modelValue', [...selected].sort((a, b) => a - b))
}
</script>

<template>
  <div
    ref="picker"
    class="week-picker"
    :class="{ 'week-picker--selectable': selectable }"
    :style="color ? { '--week-color': color } : undefined"
  >
    <button
      v-for="group in groups"
      :key="group.key"
      type="button"
      class="week-picker__item"
      :class="{
        'week-picker__item--selected': group.selected,
        'week-picker__item--merged': group.merged
      }"
      :disabled="!selectable"
      :title="groupTitle(group.weeks)"
      :aria-pressed="selectable ? group.selected : undefined"
      :data-week="group.weeks[0]"
      @pointerdown="startPainting(group.weeks, $event)"
      @dragstart.prevent
      @click="clickWeek(group.weeks, $event)"
    >
      <div class="week-number">
        {{ group.label }}
      </div>
    </button>
  </div>
</template>

<style scoped>
.week-picker {
  --week-ball-size: 1.75rem;
  --week-color: var(--event-color, var(--text-primary));

  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: calc(var(--week-ball-size) * 0.15);
}

.week-number {
  z-index: 3;
}

.week-picker__item {
  display: grid;
  place-items: center;
  box-sizing: border-box;
  width: var(--week-ball-size);
  height: var(--week-ball-size);
  padding: 0;
  border: 1px solid var(--week-color);
  border-radius: 999px;
  background-color: transparent;
  color: var(--week-color);
  font: inherit;
  font-size: clamp(0.5rem, calc(var(--week-ball-size) * 0.45), 0.875rem);
  line-height: 1;
}

.week-picker__item--merged {
  width: auto;
  min-width: var(--week-ball-size);
  padding: 0 0.4em;
}

.week-picker__item--selected {
  background-color: var(--week-color);
  color: var(--background-secondary);
}

.week-picker--selectable .week-picker__item {
  cursor: pointer;
  user-select: none;
  touch-action: none;
}

.week-picker__item:disabled {
  opacity: 1;
}
</style>
