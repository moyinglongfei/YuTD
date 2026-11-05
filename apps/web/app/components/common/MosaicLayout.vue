<script setup lang="ts" generic="T extends MosaicItem">
import {
  getMosaicWeight,
  layoutOrderedTreemap,
  type MosaicItem,
  type MosaicRect
} from '~/utils/orderedTreemap'

const props = withDefaults(defineProps<{
  items: T[]
  fixed?: 'width' | 'height' | 'both' // 固定参考父容器的宽度或高度或全部
  /** 期望宽高比的影响强度 */
  aspectPreferenceStrength?: number
  /** Target area per unit of weight, in CSS px². */
  unitArea?: number
  /** Required only in fixed='height' mode. */
  height?: number
  gap?: number
  duration?: number
}>(), {
  fixed: 'width',
  aspectPreferenceStrength: 3,
  unitArea: 42000,
  height: 480,
  gap: 8,
  duration: 480
})

defineSlots<{
  default(props: { item: T, index: number, rect: MosaicRect | undefined, size: { width: number, height: number }, gap: number }): unknown
}>()

const host = ref<HTMLElement | null>(null)
const parentWidth = ref(0)
const parentHeight = ref(0)
let resizeObserver: ResizeObserver | undefined

onMounted(() => {
  if (!host.value) return
  const update = () => {
    if (!host.value) return
    const next = host.value.getBoundingClientRect()
    if (Math.abs(next.width - parentWidth.value) > 0.5) parentWidth.value = next.width
    if (props.fixed === 'both' && Math.abs(next.height - parentHeight.value) > 0.5) parentHeight.value = next.height
  }
  update()
  resizeObserver = new ResizeObserver(update)
  resizeObserver.observe(host.value)
})
onBeforeUnmount(() => resizeObserver?.disconnect())

const totalWeight = computed(() =>
  props.items.reduce((sum, item) => sum + getMosaicWeight(item), 0)
)

const size = computed(() => {
  const area = totalWeight.value * Math.max(1, props.unitArea)
  if (props.fixed === 'height') {
    const height = Math.max(1, props.height)
    return { width: area / height, height }
  }
  const width = parentWidth.value
  if (props.fixed === 'both')
    return { width, height: parentHeight.value }
  return { width, height: width > 0 ? area / width : 0 }
})

const rects = computed(() =>
  layoutOrderedTreemap(
    props.items,
    size.value.width,
    size.value.height,
    {
      aspectPreferenceStrength: props.aspectPreferenceStrength,
      aspectDiversityStrength: 1.2
    }
  )
)

const hostStyle = computed(() => ({
  'width': props.fixed === 'height' ? `${size.value.width}px` : '100%',
  'height': props.fixed === 'both' ? '100%' : `${size.value.height}px`,
  '--mosaic-duration': `${Math.max(0, props.duration)}ms`
}))

function tileStyle(rect: MosaicRect | undefined) {
  if (!rect) return { display: 'none' }
  const gap = Math.max(0, props.gap)
  return {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    padding: `${gap / 2}px`
  }
}
</script>

<template>
  <div
    ref="host"
    class="mosaic-layout"
    :style="hostStyle"
  >
    <div
      v-for="(item, index) in items"
      :key="item.id"
      class="mosaic-layout__tile"
      :style="tileStyle(rects[index])"
    >
      <div class="mosaic-layout__content">
        <slot
          :item="item"
          :index="index"
          :rect="rects[index]"
          :size="size"
          :gap="Math.max(0, gap)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.mosaic-layout {
  position: relative;
  flex: none;
  min-width: 0;
  transition:
    width var(--mosaic-duration) cubic-bezier(.22, 1, .36, 1),
    height var(--mosaic-duration) cubic-bezier(.22, 1, .36, 1);
}
.mosaic-layout__tile {
  position: absolute;
  box-sizing: border-box;
  transition:
    left var(--mosaic-duration) cubic-bezier(.22, 1, .36, 1),
    top var(--mosaic-duration) cubic-bezier(.22, 1, .36, 1),
    width var(--mosaic-duration) cubic-bezier(.22, 1, .36, 1),
    height var(--mosaic-duration) cubic-bezier(.22, 1, .36, 1);
  min-width: 0;
  min-height: 0;
}
.mosaic-layout__content {
  overflow: hidden;
  border-radius: 12px;
  width: 100%;
  height: 100%;
}
@media (prefers-reduced-motion: reduce) {
  .mosaic-layout, .mosaic-layout__tile { transition: none; }
}
</style>
