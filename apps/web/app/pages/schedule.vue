<script setup lang="ts">
import { useApi } from '~/composables/useApi'
import EditPopup from '~/components/edit/EditPopup.vue'
import type { EditField, EditValues } from '~/utils/editFields'

type Preferences = ApiData<Api['api']['preferences']['get']>
type ScheduleSettings = Pick<Preferences, 'maxFocusScale' | 'focusColumnScale' | 'hourPixels' | 'edgePixels'>

const { mode } = useSystemStatus()
const { preferences, loading: preferencesLoading } = useAppPeferences()
const selectedPhaseId = computed(() => preferences.value?.defaultPhaseId ?? null)
const editOpen = ref(false)
const editAnchor = ref<HTMLElement | null>(null)
const preview = ref<EditValues | null>(null)
const editFields: EditField[] = [
  { key: 'maxFocusScale', label: '垂直聚焦增量', type: 'number', defaultValue: 2, min: 0, max: 5, step: 0.1, description: '实际聚焦倍数为 1 + 此值' },
  { key: 'focusColumnScale', label: '水平聚焦倍数', type: 'number', defaultValue: 3, min: 1, max: 6, step: 0.1, description: '实际倍数受显示列数限制' },
  { key: 'hourPixels', label: '每小时高度（px）', type: 'integer', defaultValue: 72, min: 24, max: 200, step: 1 },
  { key: 'edgePixels', label: '上下留白（px）', type: 'integer', defaultValue: 20, min: 0, max: 100, step: 1 }
]

const { data: phases } = useNuxtData<ApiData<Api['api']['phase']['get']>>('phases')
const savedSettings = computed<ScheduleSettings>(() => ({
  maxFocusScale: preferences.value?.maxFocusScale ?? 2,
  focusColumnScale: preferences.value?.focusColumnScale ?? 3,
  hourPixels: preferences.value?.hourPixels ?? 72,
  edgePixels: preferences.value?.edgePixels ?? 20
}))
function toSettings(values: EditValues): ScheduleSettings {
  return {
    maxFocusScale: Number(values.maxFocusScale),
    focusColumnScale: Number(values.focusColumnScale),
    hourPixels: Number(values.hourPixels),
    edgePixels: Number(values.edgePixels)
  }
}
const tableSettings = computed(() => toSettings(preview.value ?? savedSettings.value))
function saveSettings(values: EditValues) {
  if (preferences.value) Object.assign(preferences.value, toSettings(values))
}
watch(mode, (value) => {
  if (value !== 'edit') editOpen.value = false
}, { flush: 'sync' })
watch(editOpen, (open) => {
  if (!open) preview.value = null
}, { flush: 'sync' })
const phaseClient = useApi({
  key: () => `phase:${selectedPhaseId.value ?? 'none'}`,
  read: async api => selectedPhaseId.value === null
    ? null
    : api.api.phase({ id: selectedPhaseId.value }).get()
})
const phaseClientState = useAsyncData(phaseClient.key, phaseClient.read, { deep: true })
const { data: phase, refresh } = phaseClientState
const loading = computed(() => preferencesLoading.value || phaseClientState.pending.value)
</script>

<template>
  <main class="schedule-page">
    <p
      v-if="loading && !phase"
      class="page-state"
      role="status"
    >
      正在加载阶段……
    </p>
    <p
      v-else-if="phases?.length === 0"
      class="page-state"
    >
      <span>
        还没有阶段。点击侧边栏的
        <Icon
          class="phase-create-hint-icon"
          name="lucide:pen-line"
          role="img"
          aria-label="铅笔"
        />
        开启编辑模式，再点
        <Icon
          class="phase-create-hint-icon"
          name="lucide:plus"
          role="img"
          aria-label="加号"
        />
        选择「阶段」，创建你的首个 Phase。
      </span>
    </p>
    <p
      v-else-if="selectedPhaseId === null"
      class="page-state"
    >
      请先在边栏选择一个 Phase 喵。
    </p>
    <ScheduleTable
      v-else-if="phase && phase.id === selectedPhaseId"
      :key="phase.id"
      :phase-id="phase.id"
      v-bind="tableSettings"
      mode="full"
    />
    <div
      v-else
      class="page-state"
    >
      <p>阶段尚未载入。</p>
      <button
        class="button"
        type="button"
        @click="refresh()"
      >
        重新加载
      </button>
    </div>
    <button
      v-if="mode === 'edit' && phase && phase.id === selectedPhaseId"
      ref="editAnchor"
      class="button schedule-edit-trigger"
      type="button"
      :aria-expanded="editOpen"
      @click="editOpen = !editOpen"
    >
      <Icon
        name="lucide:sliders-horizontal"
        aria-hidden="true"
      />
      调整课程表
    </button>
    <EditPopup
      v-if="mode === 'edit' && preferences"
      v-model:open="editOpen"
      title="课程表参数"
      :anchor="editAnchor"
      :fields="editFields"
      :values="savedSettings"
      :save="saveSettings"
      @change="preview = editOpen ? $event : null"
    />
  </main>
</template>

<style scoped>
.schedule-page {
  width: 100%;
  min-height: var(--app-content-height);
  min-width: 0;
}

.schedule-page :deep(.event-schedule__background) {
  min-height: var(--app-content-height);
}

.schedule-edit-trigger {
  position: fixed;
  z-index: 40;
  right: calc(16px + var(--app-safe-right));
  bottom: calc(var(--app-bottom-bar-height, 0px) + 16px);
  gap: 8px;
  box-shadow: 0 4px 16px #0002;
}
</style>
