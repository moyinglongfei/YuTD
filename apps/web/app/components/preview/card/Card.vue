<script setup lang="ts">
import Block from './Block.vue'
import { CardStyleKey, glassDefaults } from './cardMaterial'
import type { CardProps } from './cardMaterial'
import type { GlassColors, GlassFrame } from './glass/edges'
import { BackgroundContextKey } from '../../image/background'

defineOptions({ name: 'MaterialCard', inheritAttrs: false })
const props = withDefaults(defineProps<CardProps>(), glassDefaults)
const emit = defineEmits<{ 'color-change': [colors: GlassColors | null] }>()
const theme = inject(CardStyleKey, null)
const background = inject(BackgroundContextKey, null)
// 只有华丽分支挂载时才加载玻璃代码，简洁分支不会运行其 setup 或计算。
const GlassMaterial = defineAsyncComponent(() => import('./glass/GlassV3.vue'))
const useGlass = computed(() => (props.showMode ?? theme?.value.showMode ?? 1) === 1 && Boolean(background))
const color = computed(() => props.color
  ?? (props.tintColor && props.tintColor.trim().toLowerCase() !== 'auto' ? props.tintColor : undefined)
  ?? theme?.value.backgroundColor ?? '#fff')
const glassProps = computed(() => {
  const { showMode: _showMode, color: _color, ...glass } = props
  return { ...glass, tintColor: props.color && props.tintColor === 'auto' ? props.color : props.tintColor }
})
const material = ref<{ updateRect?: () => void, frame?: GlassFrame, currentFrame?: GlassFrame, simplifiedOpacity?: number } | null>(null)
const colors = shallowRef<GlassColors | null>(null)
function changeColor(value: GlassColors | null) {
  colors.value = value
  emit('color-change', value)
}
watch(useGlass, () => changeColor(null), { flush: 'sync' })
defineExpose({
  updateRect: () => material.value?.updateRect?.(),
  colors,
  frame: computed(() => material.value?.frame),
  currentFrame: computed(() => material.value?.currentFrame),
  simplifiedOpacity: computed(() => material.value?.simplifiedOpacity ?? 0)
})
</script>

<template>
  <GlassMaterial
    v-if="useGlass"
    ref="material"
    v-slot="slotProps"
    v-bind="{ ...glassProps, ...$attrs }"
    class="card card--fancy"
    @color-change="changeColor"
  >
    <slot v-bind="slotProps" />
  </GlassMaterial>
  <Block
    v-else
    ref="material"
    v-slot="slotProps"
    v-bind="$attrs"
    class="card card--simple"
    :width="width"
    :height="height"
    :radius="radius"
    :color="color"
    @color-change="changeColor"
  >
    <slot v-bind="slotProps" />
  </Block>
</template>
