// 该组件用于通用卡片显示的玻璃效果的渲染,并代表glass文件夹下对外提供调用接口
<script setup lang="ts">
import { BackgroundContextKey } from '~/components/image/background'
import { GlassLayerKey, fadeGlassEdges, glassTintStyle, buildRingProjection, randomProjectionRegions, fitGlassEdges, computeGlassEffects } from './edges'
import type { GlassColors, GlassEffects } from './edges'
import { createGlassWorkerClient } from './workerPool'
import RingProjection from './RingProjection.vue'
import { glassDefaults } from '../cardMaterial'
import type { GlassProps } from '../cardMaterial'

const props = withDefaults(defineProps<GlassProps>(), glassDefaults)
const emit = defineEmits<{ 'color-change': [colors: GlassColors | null] }>()
const background = inject(BackgroundContextKey)
if (!background) throw new Error('GlassV3 需要放在 BackgroundLayout 中')
const layer = inject(GlassLayerKey)
if (!layer) throw new Error('GlassV3 需要放在 BackgroundLayout 中')
const element = ref<HTMLElement | null>(null)
const edges = ref<HTMLCanvasElement | null>(null)
const edgeSource = ref<HTMLCanvasElement | null>(null)
let edgeSize = { width: 0, height: 0 }
let edgeInset = 1
let edgeShape = ''
const frame = shallowRef({ left: 0, top: 0, width: 0, height: 0 })
const currentFrame = shallowRef(frame.value)
const centerColor = ref(props.centerGlowColor ?? 'transparent')
const colors = shallowRef<GlassColors | null>(null)
type Tint = { color: [number, number, number], opacity: number }
const tintValue = shallowRef<Tint>({ color: [0, 0, 0], opacity: 0 })
const isAutomatic = (color: string) => color.trim().toLowerCase() === 'auto'
const needsAccent = computed(() => (props.tint && isAutomatic(props.tintColor))
  || (props.edgeTint && isAutomatic(props.edgeTintColor))
  || (props.outerGlow && isAutomatic(props.outerGlowColor)))
const tintStyle = computed(() => isAutomatic(props.tintColor)
  ? glassTintStyle(tintValue.value.color, tintValue.value.opacity)
  : glassTintStyle(props.tintColor, 1))
const edgeColor = computed(() => isAutomatic(props.edgeTintColor) ? `rgb(${tintValue.value.color.join(' ')})` : props.edgeTintColor)
const edgeOpacity = computed(() => isAutomatic(props.edgeTintColor) ? tintValue.value.opacity : 1)
const projectionRegions = randomProjectionRegions()
const projection = shallowRef<GlassEffects['projection']>(null)
const id = useId()
const simplifiedOpacity = ref(0)
const windowEntry = { frame, radius: computed(() => Math.max(0, props.radius)), showOriginal: computed(() => props.showOriginal), simplifiedOpacity }
watch(() => props.passthrough, (passthrough) => {
  if (passthrough) {
    simplifiedOpacity.value = 0
    layer.windows.delete(id)
  } else {
    frame.value = currentFrame.value
    layer.windows.set(id, windowEntry)
  }
}, { immediate: true })
const style = computed(() => ({
  'width': typeof props.width === 'number' ? `${props.width}px` : props.width,
  'height': typeof props.height === 'number' ? `${props.height}px` : props.height,
  'borderRadius': `${props.radius}px`,
  'boxShadow': !props.outerGlow
    ? 'none'
    : isAutomatic(props.outerGlowColor)
      ? colors.value?.color ? `0 0 10px 1px rgb(${colors.value.color.join(' ')} / .28)` : 'none'
      : `0 0 10px 1px color-mix(in srgb, ${props.outerGlowColor} 28%, transparent)`,
  '--glass-glow': colors.value?.tone === 'light' ? '255 255 255' : '0 0 0',
  '--glass-effects': props.glow && colors.value ? 1 : 0
}))

let pendingFrame: number | undefined
let fadeFrame: number | undefined
let pixels: ImageData | undefined
let fade: { draw: (progress: number) => ImageData, start: number, fromTint: Tint, toTint: Tint } | undefined
let dirty = true
let effectVersion = 0
let calculating = false
let disposed = false
let workerFailed = false
let workerClient: ReturnType<typeof createGlassWorkerClient> | undefined
function fitEdges() {
  if (edges.value && edgeSource.value && pixels)
    fitGlassEdges(edges.value, edgeSource.value, edgeSize.width, edgeSize.height, edgeInset)
}
function resizeEdges() {
  const panel = element.value
  if (!panel) return
  const next = { width: panel.clientWidth, height: panel.clientHeight }
  const key = `${next.width}:${next.height}:${props.radius}:${props.ringDepth}:${props.ringReturn}`
  if (key !== edgeShape) {
    edgeShape = key
    edgeSize = next
    fitEdges()
    if (props.edgeTint && projection.value) projection.value = buildRingProjection(next.width, next.height, props.radius, props.ringDepth ? props.ringDepth + props.ringReturn : 0, projectionRegions)
  }
  updateRect()
}
function updateRect() {
  if (props.moving || pendingFrame !== undefined) return
  pendingFrame = requestAnimationFrame((time) => {
    pendingFrame = undefined
    if (props.moving) return
    const changed = measureRect()
    const canvas = edgeSource.value
    if (canvas && (dirty || changed)) drawEffects(canvas, time)
    dirty = false
  })
}
function animateEffects() {
  if (fadeFrame !== undefined) return
  fadeFrame = requestAnimationFrame((time) => {
    fadeFrame = undefined
    if (!fade || props.moving) return
    const progress = Math.max(0, Math.min(1, (time - fade.start) / 350))
    const eased = 1 - (1 - progress) ** 3
    pixels = fade.draw(eased)
    fitEdges()
    tintValue.value = {
      color: fade.toTint.color.map((value, channel) => Math.round(fade!.fromTint.color[channel]! * (1 - eased) + value * eased)) as Tint['color'],
      opacity: fade.fromTint.opacity * (1 - eased) + fade.toTint.opacity * eased
    }
    if (progress < 1) animateEffects()
    else fade = undefined
  })
}

function drawEffects(canvas: HTMLCanvasElement, time: number) {
  if (calculating) return
  const data = layer!.analysis.value
  if (!data) {
    if (colors.value) {
      colors.value = null
      emit('color-change', null)
    }
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    edges.value?.getContext('2d')?.clearRect(0, 0, edges.value.width, edges.value.height)
    pixels = undefined
    fade = undefined
    tintValue.value = { ...tintValue.value, opacity: 0 }
    projection.value = null
    workerClient?.dispose()
    workerClient = undefined
    return
  }
  const requestedFrame = currentFrame.value
  const options = {
    geometry: { ...background!.geometry.value },
    frame: { ...requestedFrame },
    radius: props.radius,
    depth: Math.max(0, Math.floor(props.ringDepth)),
    returnDepth: Math.max(0, Math.floor(props.ringReturn)),
    accent: needsAccent.value,
    projection: props.edgeTint,
    regions: projectionRegions
  }
  if (props.multithread && !workerFailed && typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined') {
    try {
      workerClient ??= createGlassWorkerClient()
      calculating = true
      const version = effectVersion
      void workerClient.render(data, options).then((result) => {
        if (disposed) return
        calculating = false
        if (version !== effectVersion) {
          dirty = true
          updateRect()
          return
        }
        dirty = requestedFrame !== currentFrame.value
        paintEffects(canvas, result, performance.now())
        if (dirty) updateRect()
      }).catch(() => {
        if (disposed) return
        calculating = false
        workerFailed = true
        workerClient?.dispose()
        workerClient = undefined
        dirty = true
        updateRect()
      })
      return
    } catch {
      workerFailed = true
    }
  }
  workerClient?.dispose()
  workerClient = undefined
  paintEffects(canvas, computeGlassEffects(canvas, data, options), time)
}

function paintEffects(canvas: HTMLCanvasElement, result: GlassEffects, time: number) {
  const { colors: nextColors, pixels: next } = result
  if (pixels && edges.value?.width === next.width && edges.value.height === next.height && (pixels.width !== next.width || pixels.height !== next.height)) {
    const context = edges.value.getContext('2d')
    if (context?.getImageData) pixels = context.getImageData(0, 0, next.width, next.height)
  }
  if (colors.value?.colorCss !== nextColors?.colorCss || colors.value?.tone !== nextColors?.tone) {
    colors.value = nextColors
    emit('color-change', nextColors)
  }
  if (canvas.width !== next.width) canvas.width = next.width
  if (canvas.height !== next.height) canvas.height = next.height
  projection.value = result.projection
  if (projection.value && (projection.value.width !== edgeSize.width || projection.value.height !== edgeSize.height))
    projection.value = buildRingProjection(edgeSize.width, edgeSize.height, props.radius, props.ringDepth ? props.ringDepth + props.ringReturn : 0, projectionRegions)
  edgeInset = Math.max(props.radius, props.ringDepth + props.ringReturn)
  const toTint: Tint = { color: nextColors?.color ?? tintValue.value.color, opacity: nextColors?.color ? 1 : 0 }
  const fromTint = tintValue.value.opacity < 0.001 ? { color: toTint.color, opacity: 0 } : tintValue.value
  if (pixels) {
    fade = { draw: fadeGlassEdges(canvas, pixels, next), start: time, fromTint, toTint }
    pixels = fade.draw(0)
    animateEffects()
  } else {
    pixels = next
    canvas.getContext('2d')?.putImageData(next, 0, 0)
    tintValue.value = toTint
  }
  fitEdges()
}

function measureRect() {
  const panel = element.value
  const stage = background!.element.value
  if (!panel || !stage) return false
  const bounds = panel.getBoundingClientRect()
  const parent = stage.getBoundingClientRect()
  const sx = stage.offsetWidth ? parent.width / stage.offsetWidth : 1
  const sy = stage.offsetHeight ? parent.height / stage.offsetHeight : 1
  if (!sx || !sy) return false
  const next = {
    left: (bounds.left - parent.left) / sx - stage.clientLeft + panel.clientLeft,
    top: (bounds.top - parent.top) / sy - stage.clientTop + panel.clientTop,
    width: panel.clientWidth,
    height: panel.clientHeight
  }
  const previous = currentFrame.value
  if (next.left === previous.left && next.top === previous.top && next.width === previous.width && next.height === previous.height)
    return false
  currentFrame.value = next
  if (!props.passthrough) frame.value = currentFrame.value
  return true
}

let observer: ResizeObserver | undefined
onMounted(() => {
  observer = new ResizeObserver(resizeEdges)
  observer.observe(element.value!)
  window.addEventListener('resize', updateRect)
  window.addEventListener('scroll', updateRect, { capture: true, passive: true })
  resizeEdges()
})
watch([background.element, () => props.width, () => props.height], updateRect, { flush: 'post' })
watch([edges, background.geometry, layer.analysis, () => props.radius, needsAccent, () => props.edgeTint, () => props.ringDepth, () => props.ringReturn, () => props.multithread], () => {
  dirty = true
  effectVersion++
  resizeEdges()
}, { flush: 'post' })
watch(() => props.centerGlowColor, (color) => {
  if (!props.moving) centerColor.value = color ?? 'transparent'
})
watch(() => props.moving, (moving) => {
  dirty = true
  effectVersion++
  if (moving) {
    if (pendingFrame !== undefined) cancelAnimationFrame(pendingFrame)
    if (fadeFrame !== undefined) cancelAnimationFrame(fadeFrame)
    pendingFrame = undefined
    fadeFrame = undefined
    fade = undefined
  } else {
    centerColor.value = props.centerGlowColor ?? 'transparent'
    updateRect()
  }
}, { flush: 'post' })
onBeforeUnmount(() => {
  disposed = true
  workerClient?.dispose()
  layer.windows.delete(id)
  if (pendingFrame !== undefined) cancelAnimationFrame(pendingFrame)
  if (fadeFrame !== undefined) cancelAnimationFrame(fadeFrame)
  observer?.disconnect()
  window.removeEventListener('resize', updateRect)
  window.removeEventListener('scroll', updateRect, true)
})
defineExpose({ updateRect, colors, frame, currentFrame, simplifiedOpacity })
</script>

<template>
  <div
    ref="element"
    class="glass-v3"
    :style="style"
  >
    <div
      v-if="blur > 0"
      class="glass-v3__blur"
      :style="{ backdropFilter: 'blur(' + blur + 'px)' }"
      aria-hidden="true"
    />
    <canvas
      ref="edgeSource"
      hidden
      aria-hidden="true"
    />
    <canvas
      ref="edges"
      class="glass-v3__edges"
      aria-hidden="true"
    />
    <RingProjection
      v-if="edgeTint && projection"
      class="glass-v3__projection"
      :projection="projection"
      :color-css="edgeColor"
      :style="{ opacity: edgeOpacity }"
      aria-hidden="true"
    />
    <div
      v-if="tint"
      class="glass-v3__tint"
      :style="tintStyle"
      aria-hidden="true"
    />
    <div
      class="glass-v3__center-glow"
      :style="{ backgroundColor: centerColor }"
      aria-hidden="true"
    />
    <div class="glass-v3__content">
      <slot :text-color="colors?.textColor ?? null" />
    </div>
  </div>
</template>

<style scoped>
.glass-v3 {
  position: relative;
  box-sizing: border-box;
  overflow: hidden;
  isolation: isolate;
  transition: box-shadow 350ms;
}

.glass-v3::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: inherit;
  opacity: var(--glass-effects);
  pointer-events: none;
  transition: background-color 350ms, box-shadow 350ms, opacity 350ms;
  background-color: rgb(var(--glass-glow) / .48);
  box-shadow: inset 0 0 32px 10px rgb(var(--glass-glow) / .24);
  mask-image: radial-gradient(ellipse at center, black, rgb(0 0 0 / 38%) 80%, transparent);
}

.glass-v3__tint {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.glass-v3__center-glow {
  mask-image: radial-gradient(circle at center, black, transparent 48%);
  transition: background-color 350ms;
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.glass-v3__projection {
  inset: 0;
  width: 100%;
  height: 100%;
}

.glass-v3__edges {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.glass-v3__content {
  position: relative;
  z-index: 1;
  height: 100%;
}

.glass-v3__blur {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
}
</style>
