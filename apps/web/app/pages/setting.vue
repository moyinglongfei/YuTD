<script setup lang="ts">
import RandomImageSettings from '~/components/image/RandomImageSettings.vue'
import type { Api, ApiData } from '~/utils/api'
import { requestApiData } from '~/utils/api'

type StyleData = ApiData<Api['api']['style']['get']>[number]

const { reportError } = useAppErrors()
const { preferences, loading: preferencesLoading, saving: savingPreferences } = useAppPeferences()
const phasesClient = useApi({
  key: 'phases',
  read: api => api.api.phase.get()
})
const { data: phases, pending: phasesLoading } = useAsyncData(phasesClient.key, phasesClient.read, { deep: true })
const phaseSelectValue = computed({
  get: () => preferences.value?.defaultPhaseId == null ? '' : String(preferences.value.defaultPhaseId),
  set: (value: string) => {
    if (preferences.value) preferences.value.defaultPhaseId = value === '' ? null : Number(value)
  }
})
const styleId = computed(() => preferences.value?.activeStyleId ?? null)
const writeStyleClient = useApi({
  key: () => `style:${styleId.value ?? 'none'}`,
  read: async api => styleId.value === null ? null : api.api.style({ id: styleId.value }).get(),
  write: (api, value: StyleData) => {
    const { id, ...fields } = value
    return api.api.style({ id }).patch(fields)
  }
})
const writeStyleClientState = useAsyncData(writeStyleClient.key, writeStyleClient.read, { deep: true })
const { data: style, pending: loading, error: readError, refresh: forceRead } = writeStyleClientState
const savingStyle = ref(false)
async function writeStyle(value: Parameters<typeof writeStyleClient.write>[0]) {
  savingStyle.value = true
  try {
    const result = await writeStyleClient.write(value)
    await writeStyleClientState.refresh()
    return result
  } catch {
    return undefined
  } finally {
    savingStyle.value = false
  }
}

let createdStyleId: number | null = null
const createStyleClient = useApi({
  key: 'styles',
  read: api => api.api.style.get(),
  write: async (api, value: Omit<StyleData, 'id'>) => {
    const created = await requestApiData(api.api.style.post(value), '创建样式预设失败')
    createdStyleId = created.id
    return created
  }
})
const createStyleClientState = useAsyncData(createStyleClient.key, createStyleClient.read, { deep: true })
const { data: styles } = createStyleClientState
const creating = ref(false)
async function createStyle(value: Parameters<typeof createStyleClient.write>[0]) {
  creating.value = true
  try {
    const result = await createStyleClient.write(value)
    await createStyleClientState.refresh()
    return result
  } catch {
    return undefined
  } finally {
    creating.value = false
  }
}

const draft = ref<StyleData>()
function resetDraft(value: StyleData | null | undefined) {
  draft.value = value ? { ...value } : undefined
}
watch(style, resetDraft, { immediate: true, flush: 'sync' })

const colors = [
  { key: 'backgroundPrimary', label: '主背景' },
  { key: 'backgroundSecondary', label: '次背景' },
  { key: 'textPrimary', label: '主文字' },
  { key: 'textSecondary', label: '次文字' }
] as const
const presetName = ref('')
const localFonts = useState<string[]>('app:local-fonts', () => [])
const readingFonts = ref(false)
const fontPicker = ref<HTMLDetailsElement | null>(null)
const fontSearchInput = ref<HTMLInputElement | null>(null)
const fontSearch = ref('')
const fontOptions = computed(() => {
  const options = new Map(appFontOptions.map(font => [font.value.toLocaleLowerCase(), font]))
  for (const family of [...localFonts.value, draft.value?.fontFamily ?? '']) {
    const value = family.trim()
    if (value && !options.has(value.toLocaleLowerCase()))
      options.set(value.toLocaleLowerCase(), { value, label: value })
  }
  return [...options.values()]
})
const filteredFontOptions = computed(() => {
  const query = fontSearch.value.trim().toLocaleLowerCase()
  return fontOptions.value.filter(font => !query || `${font.label} ${font.value}`.toLocaleLowerCase().includes(query))
})
const selectedFontLabel = computed(() => fontOptions.value.find(font => font.value === draft.value?.fontFamily)?.label ?? draft.value?.fontFamily)
const customFontName = computed(() => fontSearch.value.trim())
const customFontAvailable = computed(() => customFontName.value && !fontOptions.value.some(font => font.value.toLocaleLowerCase() === customFontName.value.toLocaleLowerCase()))

function closeFontPicker() {
  if (fontPicker.value)
    fontPicker.value.open = false
  fontSearch.value = ''
}

async function fontPickerToggled() {
  fontSearch.value = ''
  if (fontPicker.value?.open) {
    await nextTick()
    fontSearchInput.value?.focus({ preventScroll: true })
  }
}

function selectFont(family: string) {
  if (!draft.value || savingStyle.value || creating.value)
    return
  draft.value.fontFamily = family
  closeFontPicker()
  fontPicker.value?.querySelector('summary')?.focus()
}

function moveFontFocus(event: KeyboardEvent, step: number) {
  const options = [...(fontPicker.value?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])]
  const index = options.indexOf(event.target as HTMLButtonElement)
  options[(index + step + options.length) % options.length]?.focus()
}

function dismissFontPicker(event: PointerEvent) {
  if (fontPicker.value?.open && event.target instanceof Node && !fontPicker.value.contains(event.target))
    closeFontPicker()
}

watch(styleId, closeFontPicker)
onMounted(() => window.addEventListener('pointerdown', dismissFontPicker))
onBeforeUnmount(() => window.removeEventListener('pointerdown', dismissFontPicker))
const activeStyleId = computed({
  get: () => preferences.value?.activeStyleId ?? '',
  set: (value: string | number) => {
    if (preferences.value && value !== '')
      preferences.value.activeStyleId = Number(value)
  }
})
const timeZoneDraft = ref('')
const timeZones = ['UTC', ...(typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [])]
watch(() => preferences.value?.timeZone, (value) => {
  timeZoneDraft.value = value ?? ''
}, { immediate: true })

function saveTimeZone() {
  if (!preferences.value)
    return
  try {
    const timeZone = normalizeTimeZone(timeZoneDraft.value.trim())
    Object.assign(preferences.value, { timeZone, timeZoneAutomatic: false })
  } catch {
    reportError('请输入有效的 IANA 时区，例如 Asia/Shanghai。', '保存时区失败')
  }
}

function saveDefaultLocale() {
  if (!preferences.value)
    return
  const defaultLocale = preferences.value.defaultLocale.trim()
  if (!defaultLocale) {
    reportError('语言不能为空。', '保存语言失败')
    return
  }
  preferences.value.defaultLocale = defaultLocale
}

function validatedDraft(name = draft.value?.name) {
  if (!draft.value)
    return
  const value = {
    ...draft.value,
    name: name?.trim() ?? '',
    fontFamily: draft.value.fontFamily.trim()
  }
  if (!value.name || !value.fontFamily) {
    reportError('预设名称和字体名称不能为空。', '保存样式预设失败')
    return
  }
  return value
}

async function saveStyle() {
  const value = validatedDraft()
  if (!value || savingStyle.value || creating.value)
    return
  if (await writeStyle(value) && !readError.value && style.value) {
    resetDraft(style.value)
    if (styles.value)
      styles.value = styles.value.map(preset => preset.id === style.value!.id ? style.value! : preset)
  }
}

async function reloadStyle() {
  await forceRead()
  if (!readError.value)
    resetDraft(style.value)
}

async function saveAsPreset() {
  if (!preferences.value || savingStyle.value || creating.value)
    return
  const value = validatedDraft(presetName.value)
  if (!value)
    return
  const { id: _id, ...fields } = value
  createdStyleId = null
  if (await createStyle(fields) && createdStyleId !== null) {
    preferences.value.activeStyleId = createdStyleId
    presetName.value = ''
  }
}

async function loadFonts() {
  if (readingFonts.value)
    return
  readingFonts.value = true
  try {
    localFonts.value = await readLocalFontFamilies()
  } catch (error) {
    reportError(error instanceof DOMException && error.name === 'NotAllowedError'
      ? '尚未获得本机字体访问权限，仍可直接输入字体名称。'
      : error, '读取本机字体失败')
  } finally {
    readingFonts.value = false
  }
}

function saveSidebarWidth() {
  if (!preferences.value)
    return
  const width = Math.round(Number(preferences.value.sidebarWidth))
  preferences.value.sidebarWidth = Math.min(135, Math.max(64, Number.isFinite(width) ? width : 64))
}
</script>

<template>
  <main class="page-shell">
    <div class="page-container">
      <div class="page-grid settings-grid">
        <PageCard class="settings-phase">
          <label class="form-field">
            <span>当前阶段 · Phase</span>
            <select
              v-model="phaseSelectValue"
              class="form-control"
              :disabled="preferencesLoading || phasesLoading || !preferences || !phases?.length"
            >
              <option value="">
                {{ phasesLoading ? '正在加载阶段……' : phases?.length ? '未选择阶段' : '暂无阶段' }}
              </option>
              <option
                v-for="phase in phases ?? []"
                :key="phase.id"
                :value="String(phase.id)"
              >
                {{ phase.name }}
              </option>
            </select>
            <small class="field-help">选择后自动保存为默认阶段，首页与课程表同步切换。</small>
          </label>
        </PageCard>
        <PageCard>
          <header class="content-heading">
            <h2 class="panel-title">
              样式预设
            </h2>
            <p class="page-meta">
              修改后点击保存才提交，未保存的内容只保留在当前页面。
            </p>
          </header>
          <div class="panel-stack">
            <label class="form-field">
              <span>当前预设</span>
              <select
                v-model="activeStyleId"
                class="form-control"
                :disabled="!preferences || savingStyle || creating"
              >
                <option
                  v-if="!styles?.length"
                  value=""
                  disabled
                >正在加载预设……</option>
                <option
                  v-for="preset in styles ?? []"
                  :key="preset.id"
                  :value="preset.id"
                >
                  {{ preset.id === style?.id ? style.name : preset.name }}
                </option>
              </select>
            </label>
            <template v-if="draft">
              <label class="form-field">
                <span>显示模式</span>
                <select
                  v-model.number="draft.showMode"
                  class="form-control"
                  :disabled="savingStyle || creating"
                >
                  <option :value="0">简洁</option>
                  <option :value="1">华丽</option>
                </select>
              </label>
              <label class="form-field">
                <span>预设名称</span>
                <input
                  v-model="draft.name"
                  class="form-control"
                  maxlength="80"
                  required
                  :disabled="savingStyle || creating"
                >
              </label>
              <div class="settings-colors">
                <label
                  v-for="color in colors"
                  :key="color.key"
                  class="settings-color"
                >
                  <input
                    v-model="draft[color.key]"
                    type="color"
                    :aria-label="color.label"
                    :disabled="savingStyle || creating"
                  >
                  <span>{{ color.label }}<small>{{ draft[color.key] }}</small></span>
                </label>
              </div>
              <label class="form-field">
                <span>另存为新预设</span>
                <input
                  v-model="presetName"
                  :disabled="savingStyle || creating"
                  class="form-control"
                  placeholder="例如：夜间阅读"
                  maxlength="80"
                  @keydown.enter.prevent="saveAsPreset"
                >
              </label>
              <button
                class="button"
                type="button"
                :disabled="creating || savingStyle || !presetName.trim()"
                @click="saveAsPreset"
              >
                {{ creating ? '正在创建……' : '保存为新预设并切换' }}
              </button>
            </template>
            <p
              v-else
              class="page-state"
              role="status"
            >
              {{ loading ? '正在加载样式……' : '样式尚未载入。' }}
            </p>
            <button
              class="button button--primary"
              type="button"
              :disabled="!draft || savingStyle || creating"
              @click="saveStyle"
            >
              {{ savingStyle ? '正在保存样式……' : '保存样式' }}
            </button>
            <p
              v-if="savingStyle || savingPreferences"
              class="field-help"
              role="status"
            >
              正在保存……
            </p>
            <button
              class="button"
              type="button"
              :disabled="loading || savingStyle || creating || !preferences?.activeStyleId"
              @click="reloadStyle"
            >
              放弃修改并重新载入
            </button>
          </div>
        </PageCard>

        <div class="panel-stack">
          <PageCard>
            <header class="content-heading">
              <h2 class="panel-title">
                字体
              </h2>
            </header>
            <div
              v-if="draft"
              class="panel-stack"
            >
              <div class="form-field">
                <span>界面字体</span>
                <details
                  ref="fontPicker"
                  class="settings-font-picker"
                  @toggle="fontPickerToggled"
                  @keydown.esc.prevent.stop="closeFontPicker"
                >
                  <summary
                    class="form-control"
                    aria-label="选择界面字体"
                    @click="fontSearch = ''"
                  >
                    <span>{{ selectedFontLabel }}</span>
                    <Icon
                      name="lucide:chevron-down"
                      aria-hidden="true"
                    />
                  </summary>
                  <div class="settings-font-menu">
                    <input
                      ref="fontSearchInput"
                      v-model="fontSearch"
                      type="search"
                      class="form-control"
                      aria-label="搜索字体"
                      placeholder="输入名称查找；留空显示全部字体"
                      maxlength="200"
                      autocomplete="off"
                      @keydown.down.prevent="moveFontFocus($event, 1)"
                      @keydown.enter.prevent="selectFont(filteredFontOptions[0]?.value ?? customFontName)"
                    >
                    <div
                      class="settings-font-list"
                      role="listbox"
                      aria-label="可选字体"
                      @keydown.down.prevent="moveFontFocus($event, 1)"
                      @keydown.up.prevent="moveFontFocus($event, -1)"
                    >
                      <button
                        v-for="font in filteredFontOptions"
                        :key="font.value"
                        class="settings-font-option"
                        type="button"
                        role="option"
                        :aria-selected="draft.fontFamily === font.value"
                        :disabled="savingStyle || creating"
                        @click="selectFont(font.value)"
                      >
                        <span>{{ font.label }}</span>
                        <small v-if="font.label !== font.value">{{ font.value }}</small>
                      </button>
                    </div>
                    <button
                      v-if="customFontAvailable"
                      class="button"
                      type="button"
                      :disabled="savingStyle || creating"
                      @click="selectFont(customFontName)"
                    >
                      使用输入的字体名称：{{ customFontName }}
                    </button>
                    <p
                      v-if="!filteredFontOptions.length"
                      class="field-help"
                      role="status"
                    >
                      没有匹配项；可使用输入的名称，或清空搜索查看全部。
                    </p>
                  </div>
                </details>
                <small class="field-help">打开即显示完整列表，输入后才筛选。未安装的字体或不支持的字形会使用备用字体。</small>
              </div>
              <button
                class="button"
                type="button"
                :disabled="readingFonts"
                @click="loadFonts"
              >
                {{ readingFonts ? '正在读取……' : '读取本机字体' }}
              </button>
              <p
                v-if="localFonts.length"
                class="field-help"
              >
                已加入 {{ localFonts.length }} 种本机字体，打开字体列表即可选择或搜索。
              </p>
              <p
                class="settings-font-preview"
                :style="{ fontFamily: getAppFontStack(draft.fontFamily) }"
              >
                猫猫？<br>YuTD · Cat?. 0123456789
              </p>
            </div>
            <p
              v-else
              class="page-state"
            >
              选择样式后即可设置字体。
            </p>
          </PageCard>

          <PageCard>
            <header class="content-heading">
              <h2 class="panel-title">
                使用偏好
              </h2>
            </header>
            <div class="panel-stack">
              <template v-if="preferences">
                <label class="form-field">
                  <span>默认语言</span>
                  <input
                    v-model="preferences.defaultLocale"
                    class="form-control"
                    placeholder="zh-CN"
                    maxlength="40"
                    required
                    @change="saveDefaultLocale"
                  >
                </label>
                <label class="form-field">
                  <span><input
                    v-model="preferences.timeZoneAutomatic"
                    type="checkbox"
                  > 自动识别时区</span>
                  <small class="field-help">优先采用浏览器时区，语言地区用于兜底；各端统一使用后端保存的时区。</small>
                </label>
                <label class="form-field">
                  <span>统一时区 · {{ preferences.timeZone }}</span>
                  <input
                    v-model="timeZoneDraft"
                    class="form-control"
                    list="time-zones"
                    :disabled="preferences.timeZoneAutomatic"
                    @change="saveTimeZone"
                  >
                  <datalist id="time-zones"><option
                    v-for="zone in timeZones"
                    :key="zone"
                    :value="zone"
                  /></datalist>
                </label>
                <label class="form-field">
                  <span>侧栏宽度 · {{ preferences.sidebarWidth }} px</span>
                  <input
                    v-model.number="preferences.sidebarWidth"
                    type="range"
                    min="64"
                    max="135"
                    step="1"
                    @change="saveSidebarWidth"
                  >
                  <input
                    v-model.number="preferences.sidebarWidth"
                    class="form-control"
                    aria-label="侧栏宽度"
                    type="number"
                    min="64"
                    max="135"
                    @change="saveSidebarWidth"
                  >
                </label>
                <p class="field-help">
                  选择的阶段会自动保存为默认阶段；切换到编辑模式后，可在课程表页点击「调整课程表」设置缩放与间距。
                </p>
              </template>
              <p
                v-else
                class="page-state"
                role="status"
              >
                偏好设置尚未载入。
              </p>
            </div>
          </PageCard>
          <RandomImageSettings />
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.settings-grid { align-items: start; }
.settings-phase { display: none; }
.settings-colors { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.settings-color { display: flex; gap: 12px; align-items: center; font-size: 14px; }
.settings-color input { width: 44px; height: 44px; padding: 3px; border: 1px solid var(--border-color); border-radius: 12px; background: var(--background-secondary); cursor: pointer; }
.settings-color small { display: block; margin-top: 4px; color: var(--text-secondary); font-size: 11px; }
.settings-font-preview { margin: 0; padding: 20px; border: 1px solid var(--border-color); border-radius: 12px; line-height: 1.8; background: var(--background-primary); }
.settings-font-picker summary { display: flex; justify-content: space-between; align-items: center; gap: 10px; cursor: pointer; list-style: none; }
.settings-font-picker summary::-webkit-details-marker { display: none; }
.settings-font-picker summary span { min-width: 0; overflow-wrap: anywhere; }
.settings-font-picker[open] summary { border-color: var(--text-secondary); }
.settings-font-menu { display: grid; gap: 8px; margin-top: 8px; padding: 8px; border: 1px solid var(--border-color); border-radius: 9px; background: var(--background-secondary); }
.settings-font-list { max-height: 260px; overflow: auto; overscroll-behavior: contain; }
.settings-font-option { display: flex; flex-direction: column; align-items: flex-start; width: 100%; gap: 2px; padding: 8px 10px; border: 0; border-radius: 6px; background: transparent; color: var(--text-primary); text-align: left; overflow-wrap: anywhere; cursor: pointer; }
.settings-font-option small { color: var(--text-secondary); }
.settings-font-option:hover, .settings-font-option:focus-visible, .settings-font-option[aria-selected='true'] { background: color-mix(in srgb, var(--text-secondary) 15%, var(--background-secondary)); }
.settings-font-option:disabled { cursor: wait; opacity: .5; }
input[type='range'] { width: 100%; accent-color: var(--text-primary); }
@media (max-width: 500px) { .settings-colors { grid-template-columns: 1fr; } }
@media (width < 480px) { .settings-phase { display: block; grid-column: 1 / -1; } }
</style>
