<script setup lang="ts">
import PageCard from '~/components/preview/card/PageCard.vue'
import AppPopup from '~/components/common/AppPopup.vue'
import MosaicLayout from '~/components/common/MosaicLayout.vue'
import Block from '~/components/preview/card/Block.vue'
import ImageUploader from '~/components/image/ImageUploader.vue'
import StoredImagePreview from '~/components/image/StoredImagePreview.vue'
import { formatImageBytes, type StoredImage } from '#shared/images'
import { RESOURCE_LABELS, RESOURCE_TYPES, type ResourceSelection, type ResourceSort } from '#shared/resources'

definePageMeta({ alias: ['/images'] })

const { reportError } = useAppErrors()
const search = ref('')
const criteria = ref({ type: 'all' as ResourceSelection, search: '', tag: '', sort: 'updatedAt' as ResourceSort, page: 1 })
const limit = 24
const preview = shallowRef<StoredImage | null>(null)
const previewOpen = ref(false)
const deleteCandidate = ref(false)
const copied = ref(false)
const board = ref<HTMLElement | null>(null)
const boardWidth = ref(0)
let searchTimer: ReturnType<typeof setTimeout> | undefined
let observer: ResizeObserver | undefined

const deleteImageClient = useApi({
  key: () => `resources:${JSON.stringify(criteria.value)}`,
  read: api => api.api.resource.get({ query: {
    type: criteria.value.type,
    search: criteria.value.search,
    tag: criteria.value.tag || undefined,
    sort: criteria.value.sort,
    limit,
    offset: (criteria.value.page - 1) * limit
  } }),
  write: (api, id: string) => api.api.image({ id }).delete()
})
const deleteImageClientState = useAsyncData(deleteImageClient.key, deleteImageClient.read, { deep: true })
const { data, pending: loading, error: readError, refresh: forceRead } = deleteImageClientState
const writing = ref(false)
async function deleteImage(value: Parameters<typeof deleteImageClient.write>[0]) {
  writing.value = true
  try {
    const result = await deleteImageClient.write(value)
    await deleteImageClientState.refresh()
    return result
  } catch {
    return undefined
  } finally {
    writing.value = false
  }
}
const pages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / limit)))
const tiles = computed(() => (data.value?.items ?? []).map((item) => {
  const ratio = item.type === 'image'
    ? item.data.width / item.data.height
    : item.type === 'event' ? 1.25 : item.type === 'task' ? 1.2 : 1.4
  const preferredAspectRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1
  return { ...item, preferredAspectRatio, weight: 1 / preferredAspectRatio }
}))
const unitArea = computed(() => {
  const width = boardWidth.value || 360
  const columns = Math.max(1, Math.min(tiles.value.length, Math.round(width / 340)))
  return (width / columns) ** 2
})

function updateType(event: Event) {
  const type = (event.target as HTMLSelectElement).value as ResourceSelection
  criteria.value = { ...criteria.value, type, tag: '', page: 1 }
}

function updateSort(event: Event) {
  criteria.value = { ...criteria.value, sort: (event.target as HTMLSelectElement).value as ResourceSort, page: 1 }
}

function selectTag(tag: string) {
  criteria.value = { ...criteria.value, tag, page: 1 }
}

function changePage(page: number) {
  criteria.value = { ...criteria.value, page }
}

watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    criteria.value = { ...criteria.value, search: value.trim(), page: 1 }
  }, 250)
})
watch(data, (value) => {
  if (value && criteria.value.page > Math.max(1, Math.ceil(value.total / limit)))
    changePage(Math.max(1, Math.ceil(value.total / limit)))
})
watch(board, (element) => {
  observer?.disconnect()
  if (!element) return
  observer = new ResizeObserver(([entry]) => {
    if (entry) boardWidth.value = entry.contentRect.width
  })
  observer.observe(element)
})

function openPreview(image: StoredImage) {
  preview.value = image
  deleteCandidate.value = false
  copied.value = false
  previewOpen.value = true
}

async function removeImage() {
  const image = preview.value
  if (!image || writing.value) return
  const result = await deleteImage(image.id)
  if (!result) return
  deleteCandidate.value = false
  previewOpen.value = false
}

async function copyId() {
  if (!preview.value) return
  try {
    await navigator.clipboard.writeText(preview.value.id)
    copied.value = true
  } catch (error) {
    reportError(error, '复制图片 ID')
  }
}

onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  observer?.disconnect()
})
</script>

<template>
  <main class="resources page-shell">
    <PageCard>
      <header class="resources__header">
        <div class="resources__title-row">
          <h1>资源管理</h1>
          <select
            :value="criteria.type"
            class="resources__select"
            aria-label="资源类型"
            @change="updateType"
          >
            <option value="all">
              全部资源
            </option>
            <option
              v-for="type in RESOURCE_TYPES"
              :key="type"
              :value="type"
            >
              {{ RESOURCE_LABELS[type] }}
            </option>
          </select>
        </div>
        <ImageUploader
          v-if="criteria.type === 'all' || criteria.type === 'image'"
        />
      </header>
    </PageCard>

    <PageCard>
      <div class="resources__classifier">
        <label class="resources__search">
          <Icon name="lucide:search" />
          <input
            v-model="search"
            type="search"
            maxlength="120"
            placeholder="搜索资源"
            aria-label="搜索资源"
          >
        </label>
        <div
          v-if="(criteria.type === 'all' || criteria.type === 'task') && (data?.tags.length || criteria.tag)"
          class="resources__tags"
          role="group"
          aria-label="标签分类"
        >
          <span class="resources__muted">标签</span>
          <button
            class="resources__tag"
            type="button"
            :aria-pressed="!criteria.tag"
            @click="selectTag('')"
          >
            全部
          </button>
          <button
            v-for="tag in data?.tags ?? []"
            :key="tag.name"
            class="resources__tag"
            type="button"
            :aria-pressed="criteria.tag === tag.name"
            @click="selectTag(criteria.tag === tag.name ? '' : tag.name)"
          >
            #{{ tag.name }} <span>{{ tag.count }}</span>
          </button>
          <button
            v-if="criteria.tag && !data?.tags.some(tag => tag.name === criteria.tag)"
            class="resources__tag"
            type="button"
            aria-pressed="true"
            @click="selectTag('')"
          >
            #{{ criteria.tag }} ×
          </button>
        </div>
      </div>
    </PageCard>

    <PageCard class="resources__results">
      <div class="resources__toolbar">
        <p class="resources__muted">
          {{ RESOURCE_LABELS[criteria.type] }} · {{ data?.total ?? 0 }} 项
        </p>
        <div class="resources__toolbar-actions">
          <select
            :value="criteria.sort"
            class="resources__select"
            aria-label="资源排列顺序"
            @change="updateSort"
          >
            <option value="updatedAt">
              更新时间 · 从新到旧
            </option>
            <option value="createdAt">
              创建时间 · 从新到旧
            </option>
          </select>
          <button
            class="button"
            type="button"
            :disabled="loading || writing"
            @click="forceRead()"
          >
            刷新
          </button>
        </div>
      </div>

      <p
        v-if="loading && !data"
        class="resources__empty"
        role="status"
      >
        正在读取资源……
      </p>
      <div
        v-else-if="readError && !data"
        class="resources__empty"
      >
        <p>暂时无法读取资源。</p>
        <button
          class="button"
          type="button"
          @click="forceRead()"
        >
          重新读取
        </button>
      </div>
      <p
        v-else-if="!tiles.length"
        class="resources__empty"
      >
        {{ criteria.search || criteria.tag ? '没有找到匹配的资源。' : '暂无资源。' }}
      </p>
      <div
        v-else
        ref="board"
        class="resources__board"
        :style="{ maxWidth: `${tiles.length * 360}px` }"
        :aria-busy="loading"
      >
        <MosaicLayout
          :items="tiles"
          fixed="width"
          :unit-area="unitArea"
          :gap="14"
          :aspect-preference-strength="0.3"
        >
          <template #default="{ item }">
            <Block
              height="100%"
              color="var(--background-secondary)"
            >
              <div
                class="panel-stack"
                style="padding: 16px"
              >
                <span>{{ RESOURCE_LABELS[item.type] }}</span>
                <strong>{{ item.title }}</strong>
                <button
                  v-if="item.type === 'image'"
                  class="button"
                  type="button"
                  @click="openPreview(item.data)"
                >
                  预览图片
                </button>
              </div>
            </Block>
          </template>
        </MosaicLayout>
      </div>

      <nav
        v-if="data && pages > 1"
        class="resources__pagination"
        aria-label="资源分页"
      >
        <button
          class="button"
          type="button"
          :disabled="criteria.page <= 1 || loading || writing"
          @click="changePage(criteria.page - 1)"
        >
          上一页
        </button>
        <span>{{ criteria.page }} / {{ pages }}</span>
        <button
          class="button"
          type="button"
          :disabled="criteria.page >= pages || loading || writing"
          @click="changePage(criteria.page + 1)"
        >
          下一页
        </button>
      </nav>
    </PageCard>

    <AppPopup
      v-model:open="previewOpen"
      class="resources__dialog"
      :title="preview?.name ?? '图片资源'"
      :dismissible="!writing"
      @close="preview = null"
    >
      <template v-if="preview">
        <div class="resources__full">
          <StoredImagePreview
            :image="preview"
            variant="file"
            fit="contain"
          />
        </div>
        <div class="resources__image-info">
          <p>
            {{ preview.width }} × {{ preview.height }} · {{ formatImageBytes(preview.size) }}<template v-if="preview.size < preview.originalSize">
              · 原文件 {{ formatImageBytes(preview.originalSize) }}
            </template>
          </p>
          <code>{{ preview.id }}</code>
          <div class="resources__dialog-actions">
            <button
              class="button"
              type="button"
              @click="copyId"
            >
              {{ copied ? '已复制' : '复制 ID' }}
            </button>
            <template v-if="deleteCandidate">
              <span class="resources__muted">同时删除图片和缩略图？</span>
              <button
                class="button resources__delete"
                type="button"
                :disabled="writing"
                @click="removeImage"
              >
                {{ writing ? '删除中……' : '确认删除' }}
              </button>
              <button
                class="button"
                type="button"
                :disabled="writing"
                @click="deleteCandidate = false"
              >
                取消
              </button>
            </template>
            <button
              v-else
              class="button resources__delete"
              type="button"
              :disabled="writing"
              @click="deleteCandidate = true"
            >
              删除图片
            </button>
          </div>
        </div>
      </template>
    </AppPopup>
  </main>
</template>

<style scoped>
.resources { display: grid; align-content: start; gap: 18px; max-width: 1600px; margin-inline: auto; }
.resources__header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 24px; padding: 8px; }
.resources__title-row { display: flex; align-items: center; flex-wrap: wrap; gap: 24px; }
.resources h1 { margin: 0; font-size: clamp(36px, 5vw, 60px); font-weight: 600; letter-spacing: -0.04em; line-height: 1.25; white-space: nowrap; }
.resources__select { min-width: 0; padding: 9px 12px; color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 10px; background: var(--background-secondary); font: inherit; font-size: 13px; cursor: pointer; }
.resources__classifier { display: grid; gap: 14px; padding: 4px; }
.resources__search { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border: 1px solid var(--border-color); border-radius: 10px; background: var(--background-primary); }
.resources__search input { flex: 1; width: 100%; min-width: 0; border: 0; outline: none; color: var(--text-primary); background: transparent; font: inherit; font-size: 14px; }
.resources__search:focus-within { outline: 2px solid var(--text-secondary); outline-offset: 2px; }
.resources__tags { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.resources__tag { display: inline-flex; align-items: center; gap: 7px; padding: 6px 11px; border: 1px solid var(--border-color); border-radius: 999px; color: var(--text-secondary); background: transparent; font: inherit; font-size: 12px; cursor: pointer; }
.resources__tag[aria-pressed='true'] { color: var(--background-secondary); background: var(--text-primary); border-color: var(--text-primary); }
.resources__tag span { opacity: .65; font-variant-numeric: tabular-nums; }
.resources__muted { margin: 0; color: var(--text-secondary); font-size: 12px; }
.resources__toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin: 2px 4px 18px; }
.resources__toolbar-actions { display: flex; align-items: center; gap: 10px; }
.resources__board { width: 100%; min-width: 0; }
.resources__empty { margin: 0; padding: 60px 20px; color: var(--text-secondary); text-align: center; font-size: 14px; }
.resources__pagination { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 20px; font-size: 13px; }
.resources__dialog { --popup-width: 1000px; }
.resources__full { height: min(65dvh, 680px); }
.resources__image-info { display: grid; gap: 10px; margin-top: 14px; }
.resources__image-info p { margin: 0; color: var(--text-secondary); font-size: 12px; }
.resources__image-info code { overflow-wrap: anywhere; color: var(--text-secondary); font-size: 11px; }
.resources__dialog-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.resources__delete { color: #dc3545; }
@media (width <= 600px) {
  .resources { padding: 16px; }
  .resources__title-row { gap: 14px; }
  .resources__toolbar-actions { width: 100%; }
  .resources__toolbar-actions select { flex: 1; }
}
</style>
