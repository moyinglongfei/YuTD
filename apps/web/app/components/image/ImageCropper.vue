<script setup lang="ts">
export interface ImageCropInfo {
  originalWidth: number
  originalHeight: number
  x: number
  y: number
  width: number
  height: number
}

const props = defineProps<{
  src: string
  aspectRatio?: number
}>()
const emit = defineEmits<{
  image: [image: Blob]
  info: [info: ImageCropInfo]
  error: [error: unknown]
}>()
const image = ref<HTMLImageElement | null>(null)
const locked = ref(false)
const original = ref({ width: 0, height: 0 })
const crop = ref({ x: 0, y: 0, width: 0, height: 0 })
const exporting = ref(false)
const ready = computed(() => original.value.width > 0 && original.value.height > 0)
const ratio = computed(() => props.aspectRatio || (locked.value ? original.value.width / original.value.height : 0))
const info = computed<ImageCropInfo>(() => ({
  originalWidth: original.value.width,
  originalHeight: original.value.height,
  ...crop.value
}))
const frameStyle = computed(() => ({
  left: `${crop.value.x / original.value.width * 100}%`,
  top: `${crop.value.y / original.value.height * 100}%`,
  width: `${crop.value.width / original.value.width * 100}%`,
  height: `${crop.value.height / original.value.height * 100}%`
}))
let revision = 0 // 用户选择的图片版本号，防止异步操作返回时已经切换到新图片
let drag: {
  pointerId: number
  mode: 'move' | 'resize'
  x: number
  y: number
  scaleX: number
  scaleY: number
  crop: typeof crop.value
} | null = null

watch(() => props.src, () => {
  revision++
  drag = null
  original.value = { width: 0, height: 0 }
  exporting.value = false
}, { immediate: true, flush: 'sync' })

onBeforeUnmount(() => {
  revision++
  drag = null
})

function reset() {
  crop.value = { x: 0, y: 0, ...original.value }
  resize(original.value.width, original.value.height)
}

watch(ratio, () => {
  if (ready.value) reset()
}, { flush: 'sync' })

// 裁剪宽高最小为原图的 100px；小图最多选择整张。
function resize(width: number, height: number) {
  const maxWidth = original.value.width - crop.value.x
  const maxHeight = original.value.height - crop.value.y
  const minWidth = Math.min(100, maxWidth)
  const minHeight = Math.min(100, maxHeight)
  if (ratio.value) {
    const max = Math.min(maxWidth, maxHeight * ratio.value)
    const min = Math.min(max, Math.max(minWidth, minHeight * ratio.value))
    width = clamp(width, min, max)
    height = width / ratio.value
  } else {
    width = clamp(width, minWidth, maxWidth)
    height = clamp(height, minHeight, maxHeight)
  }
  crop.value = { ...crop.value, width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) }
}

function loaded() {
  const source = image.value
  if (!source?.naturalWidth || !source.naturalHeight) return
  original.value = { width: source.naturalWidth, height: source.naturalHeight }
  reset()
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(value)))

// 所有坐标都用原图像素，预览缩小不会改变实际裁剪尺寸。
function move(x: number, y: number) {
  crop.value = {
    ...crop.value,
    x: clamp(x, 0, original.value.width - crop.value.width),
    y: clamp(y, 0, original.value.height - crop.value.height)
  }
}

function startDrag(event: PointerEvent, mode: 'move' | 'resize') {
  if (event.button !== 0 || !ready.value || exporting.value || !image.value) return
  const bounds = image.value.getBoundingClientRect()
  if (!bounds.width || !bounds.height) return
  event.preventDefault()
  drag = {
    pointerId: event.pointerId, mode,
    x: event.clientX, y: event.clientY,
    scaleX: original.value.width / bounds.width,
    scaleY: original.value.height / bounds.height,
    crop: { ...crop.value }
  }
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture(event.pointerId)
}

function dragFrame(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.pointerId) return
  const dx = (event.clientX - drag.x) * drag.scaleX
  const dy = (event.clientY - drag.y) * drag.scaleY
  if (drag.mode === 'move') {
    move(drag.crop.x + dx, drag.crop.y + dy)
  } else {
    crop.value = { ...drag.crop }
    resize(drag.crop.width + dx, drag.crop.height + dy)
  }
}

function arrowMove(event: KeyboardEvent) {
  const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
  if (!direction || exporting.value) return
  event.preventDefault()
  const step = event.shiftKey ? 10 : 1
  move(crop.value.x + direction[0]! * step, crop.value.y + direction[1]! * step)
}

async function outputImage() {
  if (!ready.value || exporting.value || !image.value) return
  const current = revision
  const selected = { ...info.value }
  exporting.value = true
  try {
    const canvas = document.createElement('canvas')
    canvas.width = selected.width
    canvas.height = selected.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('当前浏览器无法创建裁剪画布')
    context.drawImage(image.value, selected.x, selected.y, selected.width, selected.height, 0, 0, selected.width, selected.height)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new Error('生成裁剪图片失败')), 'image/png')
    })
    if (current !== revision) return
    emit('image', blob)
    emit('info', selected)
  } catch (error) {
    if (current === revision) emit('error', error)
  } finally {
    if (current === revision) exporting.value = false
  }
}
</script>

<template>
  <div class="image-cropper">
    <div
      v-if="src"
      class="image-cropper__preview"
    >
      <div
        v-if="ready"
        class="image-cropper__tools"
      >
        <button
          v-if="!aspectRatio"
          class="button"
          type="button"
          :aria-label="locked ? '解锁比例' : '锁定原图比例'"
          :disabled="exporting"
          @click="locked = !locked"
        >
          <Icon
            :name="locked ? 'lucide:lock' : 'lucide:lock-open'"
            size="16"
          />
        </button>
        <button
          class="button"
          type="button"
          aria-label="重置裁剪区域"
          :disabled="exporting"
          @click="reset"
        >
          <Icon
            name="lucide:rotate-ccw"
            size="16"
          />
        </button>
      </div>
      <div class="image-cropper__stage">
        <img
          ref="image"
          :src="src"
          crossorigin="anonymous"
          alt="待裁剪的图片"
          draggable="false"
          @load="loaded"
          @error="emit('error', new Error('图片无法读取，请换一张图片'))"
        >
        <div
          v-if="ready"
          class="image-cropper__frame"
          :style="frameStyle"
          tabindex="0"
          role="group"
          aria-label="裁剪区域，可拖动或用方向键调整位置"
          @pointerdown="startDrag($event, 'move')"
          @pointermove="dragFrame"
          @pointerup="drag = null"
          @pointercancel="drag = null"
          @lostpointercapture="drag = null"
          @keydown.self="arrowMove"
        >
          <button
            class="image-cropper__handle"
            type="button"
            aria-label="拖动调整裁剪尺寸"
            :disabled="exporting"
            @pointerdown.stop="startDrag($event, 'resize')"
          />
        </div>
      </div>
      <div
        v-if="ready"
        ref="horizontalAxis"
        class="image-cropper__axis image-cropper__axis--x"
        :style="{ left: frameStyle.left, width: frameStyle.width }"
      >
        <span class="image-cropper__axis-line" />
        <span class="image-cropper__axis-label">{{ crop.width }}px</span>
        <span class="image-cropper__axis-line" />
      </div>
      <div
        v-if="ready"
        ref="verticalAxis"
        class="image-cropper__axis image-cropper__axis--y"
        :style="{ top: frameStyle.top, height: frameStyle.height }"
      >
        <span class="image-cropper__axis-line" />
        <span class="image-cropper__axis-label">{{ crop.height }}px</span>
        <span class="image-cropper__axis-line" />
      </div>
    </div>
    <button
      v-if="ready"
      class="button image-cropper__confirm"
      type="button"
      aria-label="确认裁剪"
      :aria-busy="exporting"
      :disabled="exporting"
      @click="outputImage"
    >
      <Icon
        name="lucide:check"
        size="18"
      />
    </button>
  </div>
</template>

<style scoped>
.image-cropper {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.image-cropper__preview {
  position: relative;
  width: fit-content;
  max-width: calc(100% - 128px);
  margin: 0 auto 28px;
}

.image-cropper__tools {
  position: absolute;
  top: 0;
  right: calc(100% + 8px);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.image-cropper__stage {
  position: relative;
  overflow: hidden;
  background: #172033;
}

.image-cropper__stage img {
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 60dvh;
  user-select: none;
}

.image-cropper__frame {
  position: absolute;
  border: 2px solid #fff;
  box-shadow: 0 0 0 9999px #0008;
  cursor: move;
  touch-action: none;
}

.image-cropper__frame::before {
  content: '';
  position: absolute;
  inset: 33.333%;
  border: 1px solid #fff5;
  pointer-events: none;
}

.image-cropper__axis {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  container-type: size;
  color: var(--text-secondary);
  white-space: nowrap;
  pointer-events: none;
}

.image-cropper__axis-label {
  flex-shrink: 0;
  font-size: clamp(9px, calc(10px + 1cqw), 14px);
  line-height: 1.2;
}

.image-cropper__axis-line {
  flex: 1;
  height: 1px;
  background: currentColor;
}

.image-cropper__axis::before,
.image-cropper__axis::after {
  content: '';
  position: absolute;
  width: 6px;
  height: 6px;
  border-top: 1px solid;
  border-left: 1px solid;
}

.image-cropper__axis--x {
  bottom: -24px;
  height: 12px;
  padding-inline: 8px;
  border-inline: 1px solid;
}

.image-cropper__axis--y {
  left: calc(100% + 28px);
  width: 12px;
  padding-block: 8px;
  flex-direction: column;
  border-block: 1px solid;
}

.image-cropper__axis--y .image-cropper__axis-line {
  width: 1px;
  height: auto;
}

.image-cropper__axis--y .image-cropper__axis-label {
  font-size: clamp(10px, calc(10px + 1cqh), 14px);
}

.image-cropper__axis--x::before {
  left: 2px;
  top: 50%;
  transform: translateY(-50%) rotate(-45deg);
}

.image-cropper__axis--x::after {
  right: 2px;
  top: 50%;
  transform: translateY(-50%) rotate(135deg);
}

.image-cropper__axis--y::before {
  top: 2px;
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
}

.image-cropper__axis--y::after {
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%) rotate(225deg);
}

.image-cropper__handle {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 2px solid #fff;
  background: #172033;
  cursor: nwse-resize;
  touch-action: none;
}

.image-cropper__tools .button,
.image-cropper__confirm {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
}

.image-cropper__confirm {
  justify-self: center;
}
</style>
