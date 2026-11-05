<script setup lang="ts">
import type { StoredImage } from '#shared/images'

const props = withDefaults(defineProps<{
  image: StoredImage
  variant?: 'file' | 'thumbnail'
  fit?: 'cover' | 'contain'
}>(), { variant: 'thumbnail', fit: 'cover' })
const root = ref<HTMLElement | null>(null)
const url = ref('')
const failed = ref(false)
let observer: IntersectionObserver | undefined
let request: AbortController | undefined
let visible = false
let disposed = false
const client = useApi({
  key: () => `image:${props.image.id}:${props.variant}`,
  read: async (api) => {
    const signal = request?.signal
    const response = await api.api.image({ id: props.image.id })[props.variant].get({ fetch: { signal } })
    signal?.throwIfAborted()
    const blob = await requestApiData(Promise.resolve(response))
    if (!(blob instanceof Blob)) throw new Error('图片响应不是有效文件')
    return blob
  }
})

async function load() {
  request?.abort()
  const controller = new AbortController()
  request = controller
  failed.value = false
  try {
    const blob = await client.read()
    if (disposed || controller.signal.aborted) return
    const previous = url.value
    url.value = URL.createObjectURL(blob)
    await nextTick()
    if (previous) URL.revokeObjectURL(previous)
  } catch {
    if (!disposed && !controller.signal.aborted) {
      failed.value = true
    }
  }
}

watch(() => [props.image.id, props.variant], () => {
  if (visible) void load()
})
onMounted(() => {
  observer = new IntersectionObserver((entries) => {
    if (!entries.some(entry => entry.isIntersecting)) return
    visible = true
    observer?.disconnect()
    void load()
  }, { rootMargin: '180px' })
  if (root.value) observer.observe(root.value)
})
onBeforeUnmount(() => {
  disposed = true
  observer?.disconnect()
  request?.abort()
  if (url.value) URL.revokeObjectURL(url.value)
})
</script>

<template>
  <div
    ref="root"
    class="stored-image-preview"
  >
    <img
      v-if="url"
      :src="url"
      :alt="image.name"
      :style="{ objectFit: fit }"
    >
    <span
      v-else
      role="status"
    >
      <Icon
        name="lucide:image"
        size="28"
      />
      {{ failed ? '预览加载失败' : '加载图片……' }}
    </span>
  </div>
</template>

<style scoped>
.stored-image-preview { position: relative; display: grid; place-items: center; width: 100%; height: 100%; min-height: 120px; overflow: hidden; background: var(--background-primary); }
.stored-image-preview img { display: block; width: 100%; height: 100%; }
.stored-image-preview span { display: grid; justify-items: center; gap: 8px; color: var(--text-secondary); font-size: 12px; }
</style>
