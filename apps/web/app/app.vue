<script setup lang="ts">
import { CardStyleKey } from '~/components/preview/card/cardMaterial'

const isLoginPage = /^\/login\/?$/.test(useRouter().currentRoute.value.path)
const { preferences, initialize } = useAppPeferences()
onMounted(() => {
  if (!isLoginPage) void initialize().catch(() => {})
})
const { mode } = useSystemStatus()
const sidebarPreview = ref<number | null>(null)
const sidebarResizing = ref(false)
const bottomSidebar = ref(false)
const sidebarMinimum = computed(() => bottomSidebar.value ? 76 : 64)
const clampSidebarSize = (value: number) => Math.min(135, Math.max(sidebarMinimum.value, Math.round(value)))
const sidebarSize = computed(() => clampSidebarSize(sidebarPreview.value ?? preferences.value?.sidebarWidth ?? 64))
let sidebarDrag: { pointerId: number, start: number, size: number, bottom: boolean, element: HTMLElement } | null = null
let sidebarMedia: MediaQueryList | undefined

function releaseSidebarDrag() {
  const drag = sidebarDrag
  sidebarDrag = null
  sidebarResizing.value = false
  if (drag?.element.hasPointerCapture(drag.pointerId)) drag.element.releasePointerCapture(drag.pointerId)
}

function cancelSidebarResize(event?: Event) {
  if (!sidebarDrag) return
  if (event && 'pointerId' in event && event.pointerId !== sidebarDrag.pointerId) return
  releaseSidebarDrag()
  sidebarPreview.value = null
}

function saveSidebarSize(value: number) {
  if (!preferences.value) return
  const size = clampSidebarSize(value)
  if (size === preferences.value.sidebarWidth) {
    sidebarPreview.value = null
    return
  }
  preferences.value.sidebarWidth = size
  sidebarPreview.value = null
}

function startSidebarResize(event: PointerEvent) {
  if (mode.value !== 'edit' || !preferences.value || event.button !== 0 || sidebarDrag) return
  const element = event.currentTarget as HTMLElement
  element.setPointerCapture(event.pointerId)
  event.preventDefault()
  sidebarDrag = { pointerId: event.pointerId, start: bottomSidebar.value ? event.clientY : event.clientX,
    size: sidebarSize.value, bottom: bottomSidebar.value, element }
  sidebarPreview.value = sidebarSize.value
  sidebarResizing.value = true
}

function moveSidebarResize(event: PointerEvent) {
  const drag = sidebarDrag
  if (!drag || drag.pointerId !== event.pointerId) return
  const delta = drag.bottom ? drag.start - event.clientY : event.clientX - drag.start
  sidebarPreview.value = clampSidebarSize(drag.size + delta)
}

function finishSidebarResize(event: PointerEvent) {
  if (!sidebarDrag || sidebarDrag.pointerId !== event.pointerId) return
  moveSidebarResize(event)
  const size = sidebarSize.value
  const unchanged = size === sidebarDrag.size
  releaseSidebarDrag()
  if (unchanged) {
    sidebarPreview.value = null
    return
  }
  void saveSidebarSize(size)
}

function resizeSidebarWithKeyboard(event: KeyboardEvent) {
  if (mode.value !== 'edit' || sidebarDrag) return
  const increments: Record<string, number> = bottomSidebar.value ? { ArrowUp: 1, ArrowDown: -1 } : { ArrowRight: 1, ArrowLeft: -1 }
  const increment = increments[event.key]
  if (increment === undefined && event.key !== 'Home' && event.key !== 'End') return
  event.preventDefault()
  void saveSidebarSize(event.key === 'Home' ? sidebarMinimum.value : event.key === 'End' ? 135 : sidebarSize.value + increment! * (event.shiftKey ? 10 : 1))
}

function updateSidebarLayout() {
  cancelSidebarResize()
  bottomSidebar.value = sidebarMedia?.matches ?? false
}
watch(mode, (value) => {
  if (value !== 'edit') cancelSidebarResize()
})
const styleId = computed(() => preferences.value?.activeStyleId ?? null)
const styleClient = useApi({
  key: () => `style:${styleId.value ?? 'none'}`,
  read: async api => styleId.value === null ? null : api.api.style({ id: styleId.value }).get()
})
const styleClientState = useAsyncData(styleClient.key, styleClient.read, { deep: true, immediate: !isLoginPage })
const { data: style } = styleClientState
provide(CardStyleKey, computed(() => ({
  showMode: style.value?.showMode ?? 0,
  backgroundColor: style.value?.backgroundSecondary ?? '#ffffff'
})))

const fontStack = computed(() => getAppFontStack(style.value?.fontFamily ?? 'system-ui'))
const theme = computed(() => ({
  '--background-primary': style.value?.backgroundPrimary ?? '#f5f7fb',
  '--background-secondary': style.value?.backgroundSecondary ?? '#ffffff',
  '--text-primary': style.value?.textPrimary ?? '#172033',
  '--text-secondary': style.value?.textSecondary ?? '#64748b',
  '--app-sidebar-width': `${sidebarSize.value}px`,
  '--app-font-family': fontStack.value === 'initial' ? 'serif' : fontStack.value,
  'font-family': fontStack.value === 'initial' ? 'initial' : 'var(--app-font-family)'
}))
useHead({
  htmlAttrs: {
    lang: () => preferences.value?.defaultLocale ?? 'zh-CN',
    style: () => Object.entries(theme.value).map(([key, value]) => `${key}:${value}`).join(';')
  }
})

const title = 'YuTD'
const description = 'YuTD 任务管理应用'
const { update } = useSystemTime()
let clientMounted = false

function detectTimeZone() {
  if (isLoginPage || !clientMounted || !preferences.value?.timeZoneAutomatic)
    return
  let detected: string
  try {
    detected = normalizeTimeZone(new Intl.DateTimeFormat(navigator.language).resolvedOptions().timeZone)
  } catch {
    detected = inferTimeZone(navigator.language || preferences.value?.defaultLocale || 'zh-CN')
  }
  if (preferences.value.timeZone !== detected)
    preferences.value.timeZone = detected
}
watch(() => [preferences.value?.timeZoneAutomatic, preferences.value?.timeZone], detectTimeZone)

let clockTimer: ReturnType<typeof setInterval> | undefined

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    update()
  }
}

onMounted(() => {
  clientMounted = true
  sidebarMedia = window.matchMedia('(width < 480px)')
  updateSidebarLayout()
  sidebarMedia.addEventListener('change', updateSidebarLayout)
  window.addEventListener('blur', cancelSidebarResize)
  void detectTimeZone()
  update()
  clockTimer = setInterval(update, 1_000)

  document.addEventListener(
    'visibilitychange',
    handleVisibilityChange
  )
})

onBeforeUnmount(() => {
  cancelSidebarResize()
  sidebarMedia?.removeEventListener('change', updateSidebarLayout)
  window.removeEventListener('blur', cancelSidebarResize)
  if (clockTimer !== undefined) {
    clearInterval(clockTimer)
  }

  document.removeEventListener(
    'visibilitychange',
    handleVisibilityChange
  )
})

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description
})
</script>

<template>
  <NuxtPage v-if="isLoginPage" />
  <div
    v-else
    class="app-layout"
    :class="{ 'app-layout--resizing': sidebarResizing }"
  >
    <AppSidebar />
    <div
      v-if="mode === 'edit' && preferences"
      class="app-sidebar-resize"
      role="separator"
      tabindex="0"
      aria-label="调整侧栏尺寸"
      :aria-orientation="bottomSidebar ? 'horizontal' : 'vertical'"
      :aria-valuenow="sidebarSize"
      :aria-valuemin="sidebarMinimum"
      :aria-valuemax="135"
      title="拖动调整侧栏尺寸，松开保存"
      @pointerdown="startSidebarResize"
      @pointermove="moveSidebarResize"
      @pointerup="finishSidebarResize"
      @pointercancel="cancelSidebarResize"
      @lostpointercapture="cancelSidebarResize"
      @keydown="resizeSidebarWithKeyboard"
    />
    <div class="app-main">
      <NuxtPage :keepalive="{ max: 4 }" />
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  --app-bottom-bar-height: var(--app-safe-bottom);
  --app-content-height: calc(100dvh - var(--app-safe-top) - var(--app-bottom-bar-height));
  min-height: 100dvh;
}

.app-main {
  margin-left: calc(var(--app-sidebar-width) + var(--app-safe-left));
  min-height: 100dvh;
  padding: var(--app-safe-top) var(--app-safe-right) var(--app-bottom-bar-height) 0;
  min-width: 0;
  box-sizing: border-box;
}
.app-sidebar-resize { position: fixed; z-index: 60; top: var(--app-safe-top); bottom: var(--app-safe-bottom); left: calc(var(--app-sidebar-width) + var(--app-safe-left) - 4px); width: 8px; cursor: col-resize; touch-action: none; }
.app-sidebar-resize::after { content: ''; position: absolute; inset: 0 3px; background: var(--text-secondary); opacity: .25; transition: opacity 160ms ease; }
.app-sidebar-resize:hover::after, .app-sidebar-resize:focus-visible::after, .app-layout--resizing .app-sidebar-resize::after { opacity: .8; }
.app-sidebar-resize[aria-disabled='true'] { cursor: wait; }
.app-layout--resizing { user-select: none; cursor: col-resize; }

@media (width < 480px) {
  .app-layout {
    --app-bottom-bar-height: calc(max(76px, var(--app-sidebar-width)) + var(--app-safe-bottom));
  }

  .app-main {
    margin-left: 0;
    padding-left: var(--app-safe-left);
    padding-bottom: var(--app-bottom-bar-height);
  }
  .app-sidebar-resize { top: auto; left: 0; right: 0; bottom: calc(var(--app-bottom-bar-height) - 4px); width: auto; height: 8px; cursor: row-resize; }
  .app-sidebar-resize::after { inset: 3px 0; }
  .app-layout--resizing { cursor: row-resize; }
}
</style>
