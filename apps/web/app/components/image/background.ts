import { computed, onBeforeUnmount, onMounted, provide, ref } from 'vue'
import type { InjectionKey, Ref } from 'vue'
import type { ImageCropInfo } from './ImageCropper.vue'

export interface BackgroundGeometry {
  centerX: number
  centerY: number
  width: number
  height: number
}

interface BackgroundContext {
  element: Readonly<Ref<HTMLElement | null>>
  src: Readonly<Ref<string>>
  geometry: Readonly<Ref<BackgroundGeometry>>
}

export const BackgroundContextKey: InjectionKey<BackgroundContext> = Symbol('image-background')

export async function loadBackgroundImage(src: string, signal?: AbortSignal) {
  signal?.throwIfAborted()
  const image = new Image()
  const abort = () => {
    image.src = ''
  }
  signal?.addEventListener('abort', abort, { once: true })
  try {
    image.src = src
    await image.decode()
    signal?.throwIfAborted()
    return image
  } finally {
    signal?.removeEventListener('abort', abort)
  }
}

export function provideBackground(
  element: Ref<HTMLElement | null>,
  src: Readonly<Ref<string>>,
  position: Readonly<Ref<ImageCropInfo | undefined>>
) {
  const size = ref({ width: 0, height: 0 })
  const imageSize = ref({ width: 0, height: 0 })
  const geometry = computed<BackgroundGeometry>(() => {
    const { width, height } = size.value
    const crop = position.value
    if (crop) {
      const scale = Math.max(width / crop.width, height / crop.height)
      return {
        centerX: width / 2 + (crop.originalWidth / 2 - crop.x - crop.width / 2) * scale,
        centerY: height / 2 + (crop.originalHeight / 2 - crop.y - crop.height / 2) * scale,
        width: crop.originalWidth * scale,
        height: crop.originalHeight * scale
      }
    }
    const source = imageSize.value
    const scale = source.width ? Math.max(width / source.width, height / source.height) : 0
    return { centerX: width / 2, centerY: height / 2, width: source.width * scale, height: source.height * scale }
  })
  const context = {
    element, src, geometry, size,
    onImageLoad: (event: Event) => {
      const image = event.target as HTMLImageElement
      if (imageSize.value.width !== image.naturalWidth || imageSize.value.height !== image.naturalHeight)
        imageSize.value = { width: image.naturalWidth, height: image.naturalHeight }
    }
  }
  provide(BackgroundContextKey, context)

  let observer: ResizeObserver | undefined
  onMounted(() => {
    const resize = () => {
      size.value = { width: element.value!.clientWidth, height: element.value!.clientHeight }
    }
    resize()
    observer = new ResizeObserver(resize)
    observer.observe(element.value!)
  })
  onBeforeUnmount(() => observer?.disconnect())

  return context
}
