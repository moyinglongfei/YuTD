<script setup lang="ts">
import ImageCropper from './ImageCropper.vue'
import AppPopup from '../common/AppPopup.vue'
import ColorCountSelect from './ColorCountSelect.vue'
import { simplifyImage } from '~/utils/simplifyImage'

defineProps<{ aspectRatio?: number }>()
const { reportError } = useAppErrors()
const colors = ref<number | 'auto'>('auto')
const client = useApi({
  key: 'image:upload',
  write: async (api, file: File) => api.api.image.post({
    file,
    thumbnail: new File([await simplifyImage(file, 'png', { colors: colors.value })], 'thumbnail.png', { type: 'image/png' })
  })
})
const input = ref<HTMLInputElement | null>(null)
const source = ref('')
const name = ref('image.png')
const uploading = ref(false)
const cropOpen = computed({
  get: () => Boolean(source.value),
  set: (value: boolean) => {
    if (!value) clearSource()
  }
})

function clearSource() {
  if (source.value) URL.revokeObjectURL(source.value)
  source.value = ''
}

function selectFile(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file || uploading.value) return
  clearSource()
  source.value = URL.createObjectURL(file)
  name.value = `${file.name.replace(/\.[^.]+$/, '')}.png`
}

async function upload(blob: Blob) {
  if (uploading.value) return
  uploading.value = true
  try {
    await client.write(new File([blob], name.value, { type: blob.type }))
    clearSource()
  } catch {
    // useApi 已统一上报，保留裁剪界面供重试。
  } finally {
    uploading.value = false
  }
}

onBeforeUnmount(clearSource)

defineExpose({ uploading, source, open: () => input.value?.click() })
</script>

<template>
  <div
    class="image-uploader"
    :aria-busy="uploading"
  >
    <button
      class="button image-select-button"
      type="button"
      :disabled="uploading"
      :aria-label="uploading ? '正在上传图片' : '上传图片'"
      :title="uploading ? '正在上传图片' : '上传图片'"
      @click="input?.click()"
    >
      <Icon
        name="lucide:image-plus"
        aria-hidden="true"
      />
      <span class="image-select-button__label">{{ uploading ? '正在上传……' : '上传图片' }}</span>
    </button>
    <input
      ref="input"
      type="file"
      accept="image/*"
      hidden
      :disabled="uploading"
      aria-label="上传图片"
      @change="selectFile"
    >
    <AppPopup
      v-model:open="cropOpen"
      title="裁剪图片"
      class="image-uploader__crop-popup"
      :dismissible="!uploading"
    >
      <ColorCountSelect
        v-model="colors"
        :disabled="uploading"
      />
      <ImageCropper
        :src="source"
        :aspect-ratio="aspectRatio"
        :inert="uploading"
        @image="upload"
        @error="reportError($event, '裁剪图片')"
      />
    </AppPopup>
  </div>
</template>

<style scoped>
.image-uploader {
  display: grid;
  justify-items: start;
  gap: 12px;
  width: min(100%, 760px);
  min-width: 0;
  container-type: inline-size;
}

.image-uploader__crop-popup { --popup-width: 900px; }
</style>
