<script setup lang="ts">
import type { ImageCropInfo } from './ImageCropper.vue'
import { provideBackground, loadBackgroundImage } from './background'
import { GlassLayerKey, type GlassLayerContext } from '../preview/card/glass/edges'
import type { SimplifiedImageData } from '~/utils/simplifyImage'

const props = withDefaults(defineProps<{
  src?: string
  image?: string
  position?: ImageCropInfo
  simplifiedImage?: string
  analysis?: SimplifiedImageData
  transitionMode?: 0 | 1
  pending?: boolean
}>(), { transitionMode: 0 })
const emit = defineEmits<{ 'error': [error: unknown], 'loading-change': [loading: 0 | 1] }>()
type Source = { image: string, simplifiedImage?: string, position?: ImageCropInfo, analysis?: SimplifiedImageData }
type Asset = { image: HTMLImageElement, owned: boolean }
type Picture = {
  id: number
  source: Source
  controller: AbortController
  simplified: Asset | null
  image: Asset | null
  simplifiedDone: boolean
  imageDone: boolean
  imageOpacity: number
  initial: boolean
}
const root = ref<HTMLElement | null>(null)
const current = shallowRef<Picture | null>(null)
const incoming = shallowRef<Picture | null>(null)
const incomingShown = ref(false)
const fading = shallowRef<Picture | null>(null)
const loading = ref<0 | 1>(0)
const progress = ref(1)
const maskMode = ref<0 | 1>(props.transitionMode)
const active = computed(() => incomingShown.value ? incoming.value : current.value && visible(current.value) ? current.value : null)
const context = provideBackground(root, computed(() => active.value?.image?.image.src ?? active.value?.simplified?.image.src ?? ''), computed(() => active.value?.source.position))
const geometry = context.geometry
const viewport = context.size
const imageId = useId()
const windows = shallowReactive<GlassLayerContext['windows']>(new Map())
provide(GlassLayerKey, {
  windows,
  image: computed(() => active.value?.simplified?.image.src),
  analysis: computed(() => active.value?.source.analysis)
})
const frames = computed(() => [...windows].map(([id, glass]) => ({ id, ...glass.frame.value, radius: glass.radius.value, original: glass.showOriginal.value, simplifiedOpacity: glass.simplifiedOpacity?.value }))
  .filter(frame => frame.width > 0 && frame.height > 0))
const pictures = computed(() => [current.value, incomingShown.value ? incoming.value : null].filter((picture): picture is Picture => Boolean(picture)))
const circleRadius = computed(() => Math.hypot(viewport.value.width, viewport.value.height)
  * (maskMode.value === 0 ? ease(progress.value) : 1 - ease(progress.value)))
let nextId = 0
let queued: Source | undefined
let transitionStarted: number | undefined
let fadeStarted: number | undefined
let animationFrame: number | undefined
let glassStarted: number | undefined
let glassId: string | undefined
let disposed = false

function visible(picture: Picture) {
  return Boolean(picture.simplified || picture.image)
}
function ease(value: number) {
  return 1 - (1 - value) ** 3
}
function animating() {
  return (incomingShown.value && progress.value < 1) || Boolean(fading.value)
}
function nextGlass() {
  if (!active.value?.simplified) return
  return [...windows].find(([, glass]) => glass.simplifiedOpacity && glass.simplifiedOpacity.value < 1
    && !glass.showOriginal.value && glass.frame.value.width > 0 && glass.frame.value.height > 0)
}
function fadeGlass(time: number) {
  const next = nextGlass()
  if (!next) return
  if (glassId !== next[0]) {
    glassId = next[0]
    glassStarted = time
  }
  next[1].simplifiedOpacity!.value = ease(Math.min(1, (time - glassStarted!) / 250))
  if (next[1].simplifiedOpacity!.value === 1) {
    glassId = undefined
    glassStarted = undefined
  }
}
function releaseAsset(asset: Asset | null) {
  if (asset?.owned) URL.revokeObjectURL(asset.image.src)
}
function retire(picture: Picture | null) {
  if (!picture) return
  picture.controller.abort()
  void nextTick(() => {
    releaseAsset(picture.simplified)
    if (picture.image !== picture.simplified) releaseAsset(picture.image)
  })
}
async function readImage(src: string, signal: AbortSignal): Promise<Asset> {
  let url = src
  const owned = src.startsWith('blob:')
  try {
    if (owned) {
      const response = await fetch(src, { signal })
      if (!response.ok) throw new Error('读取背景图片失败')
      const blob = await response.blob()
      signal.throwIfAborted()
      url = URL.createObjectURL(blob)
    }
    const image = await loadBackgroundImage(url, signal)
    signal.throwIfAborted()
    return { image, owned }
  } catch (error) {
    if (owned && url !== src) URL.revokeObjectURL(url)
    throw error
  }
}
function promote() {
  if (!incoming.value || !incomingShown.value) return
  const previous = current.value
  current.value = incoming.value
  incoming.value = null
  incomingShown.value = false
  maskMode.value = maskMode.value === 0 ? 1 : 0
  retire(previous)
}
function finish() {
  if (disposed || animating() || props.pending) return
  if (queued) {
    promote()
    const source = queued
    queued = undefined
    start(source)
    return
  }
  const picture = incoming.value ?? current.value
  if (!picture || !picture.imageDone || !picture.simplifiedDone) return
  if (incoming.value && !incomingShown.value) {
    retire(incoming.value)
    incoming.value = null
  } else promote()
  loading.value = 0
}
function schedule() {
  if (animationFrame !== undefined || disposed) return
  animationFrame = requestAnimationFrame((time) => {
    animationFrame = undefined
    if (incomingShown.value && progress.value < 1) {
      transitionStarted ??= time
      progress.value = Math.min(1, (time - transitionStarted) / 350)
    }
    if (fading.value) {
      fadeStarted ??= time
      fading.value.imageOpacity = ease(Math.min(1, (time - fadeStarted) / 250))
      if (fading.value.imageOpacity === 1) fading.value = null
    }
    if (loading.value === 0) fadeGlass(time)
    if (animating()) schedule()
    else {
      finish()
      if (loading.value === 0 && nextGlass()) schedule()
    }
  })
}
function show(picture: Picture) {
  if (picture === incoming.value && !incomingShown.value) {
    if (!picture.simplified && !picture.simplifiedDone) return
    if (!visible(picture)) return
    incomingShown.value = true
    progress.value = 0
    transitionStarted = undefined
    schedule()
  }
  if (picture.image && picture.imageOpacity === 0 && !fading.value) {
    if (!picture.initial && picture.simplified && picture.simplified !== picture.image) {
      fading.value = picture
      fadeStarted = undefined
      schedule()
    } else picture.imageOpacity = 1
  }
}
function start(source: Source) {
  if (incomingShown.value) promote()
  retire(incoming.value)
  incoming.value = null
  current.value?.controller.abort()
  const picture = shallowReactive<Picture>({
    id: ++nextId, source, controller: new AbortController(), simplified: null, image: null,
    simplifiedDone: !source.simplifiedImage, imageDone: !source.image, imageOpacity: 0,
    initial: !current.value || !visible(current.value)
  })
  if (current.value && visible(current.value)) incoming.value = picture
  else {
    retire(current.value)
    current.value = picture
  }
  loading.value = 1
  const read = async (variant: 'simplified' | 'image', src: string) => {
    try {
      const asset = await readImage(src, picture.controller.signal)
      if (picture.controller.signal.aborted || disposed) {
        releaseAsset(asset)
        return
      }
      picture[variant] = asset
      if (source.image === source.simplifiedImage) picture.simplified = picture.image = asset
    } catch (error) {
      if (!picture.controller.signal.aborted && !disposed) emit('error', error)
    } finally {
      if (!picture.controller.signal.aborted && !disposed) {
        picture[variant === 'image' ? 'imageDone' : 'simplifiedDone'] = true
        if (source.image === source.simplifiedImage) picture.imageDone = picture.simplifiedDone = true
        show(picture)
        finish()
      }
    }
  }
  if (source.simplifiedImage && source.simplifiedImage !== source.image) void read('simplified', source.simplifiedImage)
  if (source.image) void read('image', source.image)
  if (!source.image && !source.simplifiedImage) finish()
}
watch([active, () => active.value?.image, () => active.value?.simplified], () => {
  const image = active.value?.image?.image ?? active.value?.simplified?.image
  if (image) context.onImageLoad({ target: image } as unknown as Event)
}, { flush: 'sync' })
watch(loading, (value) => {
  emit('loading-change', value)
  glassId = undefined
  glassStarted = undefined
  if (value === 1) {
    for (const glass of windows.values()) {
      if (glass.simplifiedOpacity) glass.simplifiedOpacity.value = 0
    }
  } else if (nextGlass()) schedule()
}, { flush: 'sync' })
watch(() => [...windows].map(([id, glass]) => [id, glass.showOriginal.value, glass.frame.value.width > 0, glass.frame.value.height > 0]), () => {
  for (const glass of windows.values()) {
    if (glass.showOriginal.value && glass.simplifiedOpacity) glass.simplifiedOpacity.value = 0
  }
  if (loading.value === 0 && nextGlass()) schedule()
})
onMounted(() => {
  watch(() => [props.src ?? props.image ?? '', props.simplifiedImage, props.position, props.analysis, props.pending] as const, ([image, simplifiedImage, position, analysis, pending]) => {
    if (pending) {
      loading.value = 1
      return
    }
    const source = { image, simplifiedImage, position, analysis }
    const picture = incoming.value ?? current.value
    if (picture && picture.source.image === image && picture.source.simplifiedImage === simplifiedImage) {
      picture.source = source
      queued = undefined
      finish()
    } else if (animating()) queued = source
    else start(source)
  }, { immediate: true, flush: 'post' })
})
onBeforeUnmount(() => {
  disposed = true
  if (animationFrame !== undefined) cancelAnimationFrame(animationFrame)
  retire(current.value)
  retire(incoming.value)
})

function imageGeometry(picture: Picture) {
  if (picture === active.value) {
    const value = geometry.value
    return { x: value.centerX - value.width / 2, y: value.centerY - value.height / 2, width: value.width, height: value.height }
  }
  const { width, height } = viewport.value
  const image = picture.image?.image ?? picture.simplified?.image
  const crop = picture.source.position
  if (crop) {
    const scale = Math.max(width / crop.width, height / crop.height)
    return { x: width / 2 - (crop.x + crop.width / 2) * scale, y: height / 2 - (crop.y + crop.height / 2) * scale, width: crop.originalWidth * scale, height: crop.originalHeight * scale }
  }
  const scale = image?.naturalWidth ? Math.max(width / image.naturalWidth, height / image.naturalHeight) : 0
  const w = (image?.naturalWidth ?? 0) * scale
  const h = (image?.naturalHeight ?? 0) * scale
  return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h }
}

defineExpose({ geometry: context.geometry, imageUrl: context.src, loading, maskMode })
</script>

<template>
  <div
    ref="root"
    class="background-layout"
    :aria-busy="loading === 1"
  >
    <svg
      class="background-layout__image"
      aria-hidden="true"
    >
      <use :href="`#${imageId}-scene`" />
    </svg>
    <svg
      class="background-layout__glass"
      aria-hidden="true"
    >
      <defs>
        <g
          v-for="picture in pictures"
          :id="`${imageId}-picture-${picture.id}`"
          :key="picture.id"
        >
          <image
            v-if="picture.simplified"
            :data-layer="picture === current ? 'simplified' : 'new-simplified'"
            :href="picture.simplified.image.src"
            v-bind="imageGeometry(picture)"
            :opacity="picture.imageOpacity === 1 ? 0 : 1"
            preserveAspectRatio="none"
          />
          <image
            v-if="picture.image"
            :data-layer="picture === current ? 'image' : 'new-image'"
            :href="picture.image.image.src"
            v-bind="imageGeometry(picture)"
            :opacity="picture.imageOpacity"
            preserveAspectRatio="none"
          />
        </g>
        <g :id="`${imageId}-scene`">
          <use
            v-for="picture in pictures"
            :key="picture.id"
            :href="`#${imageId}-picture-${picture.id}`"
            :mask="incomingShown ? `url(#${imageId}-transition-${(picture === current) === (maskMode === 0) ? 'outside' : 'inside'}-mask)` : undefined"
          />
        </g>
        <image
          v-if="active"
          :id="`${imageId}-simplified`"
          :href="active.simplified?.image.src ?? active.image?.image.src"
          v-bind="imageGeometry(active)"
          preserveAspectRatio="none"
        />
        <clipPath
          v-for="original in [false, true]"
          :id="`${imageId}-glass-${original ? 'original' : 'simplified'}-clip`"
          :key="String(original)"
          clipPathUnits="userSpaceOnUse"
        >
          <rect
            v-for="frame in frames.filter(frame => original ? frame.original || frame.simplifiedOpacity !== undefined || incomingShown : !frame.original)"
            :key="frame.id"
            :x="frame.left"
            :y="frame.top"
            :width="frame.width"
            :height="frame.height"
            :rx="frame.radius"
          />
        </clipPath>
        <mask
          :id="`${imageId}-glass-simplified-mask`"
          x="0"
          y="0"
          :width="viewport.width"
          :height="viewport.height"
          maskUnits="userSpaceOnUse"
          style="mask-type: luminance"
        >
          <rect
            v-for="frame in frames.filter(frame => !frame.original)"
            :key="frame.id"
            :x="frame.left"
            :y="frame.top"
            :width="frame.width"
            :height="frame.height"
            :rx="frame.radius"
            fill="white"
            :opacity="incomingShown ? 0 : frame.simplifiedOpacity ?? 1"
          />
        </mask>
        <template v-if="incomingShown">
          <mask
            v-for="inside in [true, false]"
            :id="`${imageId}-transition-${inside ? 'inside' : 'outside'}-mask`"
            :key="String(inside)"
            x="0"
            y="0"
            :width="viewport.width"
            :height="viewport.height"
            maskUnits="userSpaceOnUse"
            style="mask-type: luminance"
          >
            <rect
              :width="viewport.width"
              :height="viewport.height"
              :fill="inside ? 'black' : 'white'"
            />
            <circle
              cx="0"
              :cy="viewport.height"
              :r="circleRadius"
              :fill="inside ? 'white' : 'black'"
            />
          </mask>
        </template>
      </defs>
      <use
        v-for="original in [true, false]"
        :key="String(original)"
        :href="`#${imageId}-${original ? 'scene' : 'simplified'}`"
        :clip-path="`url(#${imageId}-glass-${original ? 'original' : 'simplified'}-clip)`"
        :mask="original ? undefined : `url(#${imageId}-glass-simplified-mask)`"
      />
    </svg>
    <div class="background-layout__content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.background-layout { position: relative; width: 100%; height: 100%; overflow: hidden; }
.background-layout__image, .background-layout__glass { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; user-select: none; }
.background-layout__content { position: relative; width: 100%; height: 100%; }
</style>
