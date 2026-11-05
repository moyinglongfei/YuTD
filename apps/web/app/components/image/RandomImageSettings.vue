<script setup lang="ts">
import PageCard from '../preview/card/PageCard.vue'
import StoredImagePreview from './StoredImagePreview.vue'
import type { ImageRotation } from '#shared/images'

const saved = shallowRef<ImageRotation | null>(null)
const selected = ref<Record<string, boolean>>({})
const search = ref('')
const page = ref(1)
const loading = ref(true)
const saving = ref<'save' | 'shuffle' | null>(null)
const failed = ref(false)
const client = useApi({
  key: 'image:random-settings',
  read: api => api.api.image.random.get(),
  write: (api, value: { images: { id: string, enabled: boolean }[], reshuffle?: boolean }) => api.api.image.random.patch(value)
})
const dirty = computed(() => saved.value?.items.some(item => selected.value[item.image.id] !== item.enabled) ?? false)
const selectedCount = computed(() => Object.values(selected.value).filter(Boolean).length)
const filtered = computed(() => (saved.value?.items ?? []).filter(item => item.image.name.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase())))
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / 12)))
const images = computed(() => filtered.value.slice((page.value - 1) * 12, page.value * 12))

function apply(value: ImageRotation) {
  saved.value = value
  selected.value = Object.fromEntries(value.items.map(item => [item.image.id, item.enabled]))
}
async function load() {
  loading.value = true
  failed.value = false
  try {
    apply(await client.read())
    page.value = 1
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}
async function save(reshuffle = false) {
  if (!saved.value || saving.value) return
  saving.value = reshuffle ? 'shuffle' : 'save'
  try {
    apply(await client.write({ images: saved.value.items.map(item => ({ id: item.image.id, enabled: Boolean(selected.value[item.image.id]) })), reshuffle }))
  } catch {
    // useApi 已上报，保留尚未保存的选择。
  } finally {
    saving.value = null
  }
}
function selectAll(enabled: boolean) {
  selected.value = Object.fromEntries((saved.value?.items ?? []).map(item => [item.image.id, enabled]))
}
watch(search, () => {
  page.value = 1
})
onMounted(load)
</script>

<template>
  <PageCard>
    <header class="content-heading">
      <h2 class="panel-title">
        随机底图轮播
      </h2>
    </header>
    <div class="panel-stack">
      <p class="field-help">
        选择参与随机轮播的图片。新上传的图片会自动加入；已有日期和周数的底图保持原样。
      </p>
      <p
        v-if="loading"
        class="page-state"
        role="status"
      >
        正在加载轮播图片……
      </p>
      <template v-else-if="saved">
        <p
          class="field-help"
          role="status"
        >
          已选 {{ selectedCount }} 张 · 本轮待选 {{ saved.remaining }} 张<span v-if="dirty"> · 有未保存修改</span>
        </p>
        <template v-if="saved.items.length">
          <input
            v-model="search"
            class="form-control"
            type="search"
            aria-label="搜索轮播图片"
            placeholder="搜索图片名称"
          >
          <div class="random-images__actions">
            <button
              type="button"
              class="button"
              :disabled="Boolean(saving)"
              @click="selectAll(true)"
            >
              全部加入
            </button>
            <button
              type="button"
              class="button"
              :disabled="Boolean(saving)"
              @click="selectAll(false)"
            >
              全部移出
            </button>
          </div>
          <div class="random-images__grid">
            <label
              v-for="item in images"
              :key="item.image.id"
              class="random-images__item"
              :class="{ 'random-images__item--selected': selected[item.image.id] }"
            >
              <div class="random-images__preview">
                <StoredImagePreview :image="item.image" />
                <input
                  v-model="selected[item.image.id]"
                  type="checkbox"
                  :disabled="Boolean(saving)"
                  :aria-label="`让 ${item.image.name} 参与轮播`"
                >
              </div>
              <span class="random-images__name">{{ item.image.name }}</span>
              <small>{{ !item.enabled ? '未加入轮播' : item.position === null ? '本轮已选过' : '本轮待选' }}</small>
            </label>
          </div>
          <p
            v-if="!filtered.length"
            class="field-help"
          >
            没有找到匹配的图片。
          </p>
          <div
            v-if="pages > 1"
            class="random-images__actions"
          >
            <button
              type="button"
              class="button"
              :disabled="page <= 1"
              aria-label="上一页图片"
              @click="page--"
            >
              上一页
            </button>
            <span>{{ page }} / {{ pages }}</span>
            <button
              type="button"
              class="button"
              :disabled="page >= pages"
              aria-label="下一页图片"
              @click="page++"
            >
              下一页
            </button>
          </div>
          <p
            v-if="!selectedCount"
            class="field-help"
          >
            保存后，随机底图将暂时没有可选图片。
          </p>
          <div class="random-images__actions">
            <button
              type="button"
              class="button button--primary"
              :disabled="!dirty || Boolean(saving)"
              @click="save()"
            >
              {{ saving === 'save' ? '正在保存……' : '保存轮播' }}
            </button>
            <button
              type="button"
              class="button"
              :disabled="!dirty || Boolean(saving)"
              @click="apply(saved)"
            >
              放弃修改
            </button>
            <button
              type="button"
              class="button"
              :disabled="dirty || !saved.total || Boolean(saving)"
              :title="dirty ? '请先保存轮播选择' : '重新开始一轮随机轮播'"
              @click="save(true)"
            >
              {{ saving === 'shuffle' ? '正在洗牌……' : '重新洗牌' }}
            </button>
          </div>
        </template>
        <p
          v-else
          class="field-help"
        >
          图库还没有图片，可以先到资源库上传。
        </p>
      </template>
      <p
        v-if="failed"
        class="field-help"
        role="status"
      >
        轮播图片未能载入，可以重新加载。
      </p>
      <button
        type="button"
        class="button"
        :disabled="loading || Boolean(saving) || dirty"
        @click="load"
      >
        重新加载
      </button>
    </div>
  </PageCard>
</template>

<style scoped>
.random-images__actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.random-images__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px; }
.random-images__item { min-width: 0; display: grid; gap: 6px; padding: 6px; border: 1px solid var(--border-color); border-radius: 10px; cursor: pointer; }
.random-images__item--selected { border-color: var(--accent-color); }
.random-images__preview { position: relative; height: 100px; overflow: hidden; border-radius: 6px; }
.random-images__preview :deep(.stored-image-preview) { min-height: 0; }
.random-images__preview input { position: absolute; top: 6px; left: 6px; width: 18px; height: 18px; accent-color: var(--accent-color); }
.random-images__name { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 13px; }
.random-images__item small { color: var(--text-secondary); font-size: 11px; }
</style>
