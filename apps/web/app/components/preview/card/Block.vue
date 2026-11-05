<script setup lang="ts">
import BlockCorners from './BlockCorners.vue'
import { blockColors, CardStyleKey } from './cardMaterial'
import type { GlassColors } from './glass/edges'

defineOptions({ name: 'MaterialBlock' })
const props = withDefaults(defineProps<{
  width?: number | string
  height?: number | string
  color?: string
  radius?: number
}>(), { color: '#fff', radius: 12 })
const emit = defineEmits<{ 'color-change': [colors: GlassColors] }>()
const theme = inject(CardStyleKey, null)
const element = ref<HTMLElement | null>(null)
const resolvedColor = ref<string | null>(null)
const colors = computed(() => blockColors(resolvedColor.value ?? props.color) ?? blockColors('#fff')!)
const style = computed(() => ({
  'width': typeof props.width === 'number' ? `${props.width}px` : props.width,
  'height': typeof props.height === 'number' ? `${props.height}px` : props.height,
  'borderRadius': `${Math.max(0, props.radius)}px`,
  'backgroundColor': '#fff',
  '--block-color': props.color,
  'color': colors.value.textColor,
  '--card-text-color': colors.value.textColor,
  '--corner-color': `color-mix(in srgb, ${colors.value.textColor} 45%, transparent)`
}))

function updateColor() {
  resolvedColor.value = element.value ? getComputedStyle(element.value, '::before').backgroundColor : null
}
watch([() => props.color, () => theme?.value.backgroundColor], updateColor, { flush: 'post' })
watch(colors, value => emit('color-change', value), { immediate: true })
onMounted(updateColor)
defineExpose({ colors })
</script>

<template>
  <div
    ref="element"
    class="block"
    :style="style"
  >
    <BlockCorners :radius="radius" />
    <div class="block__content">
      <slot :text-color="colors.textColor" />
    </div>
  </div>
</template>

<style scoped>
.block {
  position: relative;
  box-sizing: border-box;
  min-width: 0;
  overflow: hidden;
  isolation: isolate;
}
.block::before {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--block-color);
  pointer-events: none;
  content: '';
}
.block__content { position: relative; height: 100%; }
</style>
