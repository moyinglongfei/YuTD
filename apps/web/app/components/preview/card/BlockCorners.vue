<script setup lang="ts">
const props = withDefaults(defineProps<{ radius?: number }>(), { radius: 6 })
const corners = ref<HTMLElement | null>(null)
const size = shallowRef({ width: 0, height: 0 })
let observer: ResizeObserver | undefined

const cornerStyle = computed(() => {
  const { width, height } = size.value
  const longestSide = Math.max(width, height, 1)
  const radius = Math.max(0, Math.min(props.radius, width / 2, height / 2))
  const length = Math.min(Math.max(14, radius * 2), longestSide / 2)
  const horizontal = Math.min(width / 2, Math.max(radius + 2.5, length * width / longestSide))
  const vertical = Math.min(height / 2, Math.max(radius + 2.5, length * height / longestSide))

  return {
    '--corner-horizontal': `${horizontal}px`,
    '--corner-vertical': `${vertical}px`,
    '--corner-stroke': `${Math.min(2.5, horizontal, vertical)}px`,
    '--corner-radius': `${radius}px`
  }
})

onMounted(() => {
  if (!corners.value)
    return

  observer = new ResizeObserver(([entry]) => {
    if (!entry)
      return

    size.value = {
      width: entry.contentRect.width,
      height: entry.contentRect.height
    }
  })
  observer.observe(corners.value)
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div
    ref="corners"
    class="block-corners"
    :style="cornerStyle"
    aria-hidden="true"
  >
    <span class="block-corner block-corner--top-left" />
    <span class="block-corner block-corner--top-right" />
    <span class="block-corner block-corner--bottom-left" />
    <span class="block-corner block-corner--bottom-right" />
  </div>
</template>

<style scoped>
.block-corners {
  position: absolute;
  z-index: 2;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
}

.block-corner {
  position: absolute;
  box-sizing: border-box;
  width: var(--corner-horizontal);
  height: var(--corner-vertical);
  border: 0 solid var(--corner-color, var(--event-color, var(--text-primary)));
}

.block-corner--top-left {
  top: 0;
  left: 0;
  border-top-width: var(--corner-stroke);
  border-left-width: var(--corner-stroke);
  border-top-left-radius: var(--corner-radius);
}

.block-corner--top-right {
  top: 0;
  right: 0;
  border-top-width: var(--corner-stroke);
  border-right-width: var(--corner-stroke);
  border-top-right-radius: var(--corner-radius);
}

.block-corner--bottom-left {
  bottom: 0;
  left: 0;
  border-bottom-width: var(--corner-stroke);
  border-left-width: var(--corner-stroke);
  border-bottom-left-radius: var(--corner-radius);
}

.block-corner--bottom-right {
  right: 0;
  bottom: 0;
  border-right-width: var(--corner-stroke);
  border-bottom-width: var(--corner-stroke);
  border-bottom-right-radius: var(--corner-radius);
}
</style>
