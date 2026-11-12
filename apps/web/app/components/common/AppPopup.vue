<script lang="ts">
interface PopupEntry {
  element: HTMLElement
  close: (restoreFocus?: boolean) => void
}

const popupStack: PopupEntry[] = []
const scrollLocks = new WeakMap<Document, { count: number, overflow: string, gutter: string }>()

function lockScroll(document: Document) {
  const style = document.documentElement.style
  const lock = scrollLocks.get(document) ?? { count: 0, overflow: style.overflow, gutter: style.scrollbarGutter }
  if (lock.count === 0) {
    scrollLocks.set(document, lock)
    style.scrollbarGutter = 'stable'
    style.overflow = 'hidden'
  }
  lock.count++
  return () => {
    if (--lock.count > 0) return
    style.overflow = lock.overflow
    style.scrollbarGutter = lock.gutter
    scrollLocks.delete(document)
  }
}
</script>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  mode?: 'dialog' | 'popover' | 'panel'
  anchor?: HTMLElement | null
  title?: string
  dismissible?: boolean
  closeOnOutside?: boolean
  closeOnEsc?: boolean
}>(), {
  mode: 'dialog',
  anchor: null,
  title: '',
  dismissible: true,
  closeOnOutside: true,
  closeOnEsc: true
})
const opened = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ open: [], close: [] }>()
const { reportError } = useAppErrors()
const element = ref<HTMLElement | null>(null)
const active = ref(false)
const titleId = useId()
let visible = false
let revision = 0
let entry: PopupEntry | undefined
let previousFocus: HTMLElement | null = null
let releaseScroll: (() => void) | undefined
let observer: ResizeObserver | undefined
let positionFrame: number | undefined
let pointerDown: { id: number, outside: boolean } | undefined

function isTop() {
  return entry !== undefined && popupStack.at(-1) === entry
}

function position() {
  const node = element.value
  if (!visible || !node) return
  const viewport = window.visualViewport
  const safeArea = getComputedStyle(document.documentElement)
  const inset = (edge: string) => Number.parseFloat(safeArea.getPropertyValue(`--app-safe-${edge}`)) || 0
  const left = (viewport?.offsetLeft ?? 0) + inset('left') + 12
  const top = (viewport?.offsetTop ?? 0) + inset('top') + 12
  const width = Math.max(0, (viewport?.width ?? window.innerWidth) - inset('left') - inset('right') - 24)
  const height = Math.max(0, (viewport?.height ?? window.innerHeight) - inset('top') - inset('bottom') - 24)
  node.style.maxWidth = `${width}px`
  node.style.maxHeight = `${height}px`
  const popupWidth = node.offsetWidth
  const popupHeight = node.offsetHeight
  let x = left + (width - popupWidth) / 2
  let y = top + (height - popupHeight) / 2
  if (props.mode === 'popover' && props.anchor) {
    const anchor = props.anchor.getBoundingClientRect()
    x = anchor.left
    y = anchor.bottom + 6 + popupHeight <= top + height
      ? anchor.bottom + 6
      : anchor.top - popupHeight - 6
  }
  node.style.left = `${Math.max(left, Math.min(x, left + width - popupWidth))}px`
  node.style.top = `${Math.max(top, Math.min(y, top + height - popupHeight))}px`
}

function schedulePosition() {
  if (positionFrame !== undefined) return
  positionFrame = requestAnimationFrame(() => {
    positionFrame = undefined
    position()
  })
}

function observeSize() {
  observer?.disconnect()
  if (!visible || !element.value) return
  observer = new ResizeObserver(schedulePosition)
  observer.observe(element.value)
  if (props.anchor) observer.observe(props.anchor)
  schedulePosition()
}

function outside(event: PointerEvent) {
  if (!element.value || (props.anchor && event.composedPath().includes(props.anchor))) return false
  const rect = element.value.getBoundingClientRect()
  return event.clientX < rect.left || event.clientX > rect.right
    || event.clientY < rect.top || event.clientY > rect.bottom
}

function onPointerDown(event: PointerEvent) {
  pointerDown = isTop() && event.button === 0
    ? { id: event.pointerId, outside: outside(event) }
    : undefined
}

function onPointerUp(event: PointerEvent) {
  const dismiss = isTop() && props.closeOnOutside && pointerDown?.id === event.pointerId
    && pointerDown.outside && outside(event)
  pointerDown = undefined
  if (dismiss) requestClose()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented || !isTop() || props.mode !== 'popover') return
  event.preventDefault()
  event.stopPropagation()
  if (props.closeOnEsc) requestClose()
}

function requestClose() {
  if (props.dismissible) close()
}

function onCancel(event: Event) {
  event.preventDefault()
  if (isTop() && props.closeOnEsc) requestClose()
}

function removeListeners() {
  document.removeEventListener('pointerdown', onPointerDown, true)
  document.removeEventListener('pointerup', onPointerUp, true)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', schedulePosition)
  window.removeEventListener('scroll', schedulePosition, true)
  window.visualViewport?.removeEventListener('resize', schedulePosition)
  window.visualViewport?.removeEventListener('scroll', schedulePosition)
  observer?.disconnect()
  observer = undefined
  if (positionFrame !== undefined) cancelAnimationFrame(positionFrame)
  positionFrame = undefined
  pointerDown = undefined
}

function close(restoreFocus = true) {
  revision++
  opened.value = false
  const index = entry ? popupStack.indexOf(entry) : -1
  if (index >= 0) {
    for (const child of popupStack.slice(index + 1).reverse()) child.close(false)
    popupStack.splice(index, 1)
  }
  entry = undefined
  const wasVisible = visible
  visible = false
  if (import.meta.client && props.mode !== 'panel') {
    removeListeners()
    const node = element.value
    if (node instanceof HTMLDialogElement) {
      if (node.open) node.close()
    } else if (node?.matches(':popover-open')) {
      node.hidePopover()
    }
    releaseScroll?.()
    releaseScroll = undefined
    if (wasVisible && restoreFocus && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
  }
  active.value = false
  if (wasVisible) emit('close')
}

async function syncOpen() {
  if (props.mode === 'panel') {
    active.value = opened.value
    visible = opened.value
    return
  }
  if (!opened.value) {
    close()
    return
  }
  if (visible) return
  const current = ++revision
  active.value = true
  await nextTick()
  const node = element.value
  if (current !== revision || !opened.value || !node?.isConnected) return
  previousFocus = props.anchor ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
  entry = { element: node, close }
  popupStack.push(entry)
  visible = true
  try {
    if (node instanceof HTMLDialogElement) {
      node.showModal()
      releaseScroll = lockScroll(document)
    } else {
      node.showPopover()
    }
    position()
    observeSize()
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('pointerup', onPointerUp, true)
    document.addEventListener('keydown', onKeydown)
    window.addEventListener('resize', schedulePosition)
    window.addEventListener('scroll', schedulePosition, { capture: true, passive: true })
    window.visualViewport?.addEventListener('resize', schedulePosition)
    window.visualViewport?.addEventListener('scroll', schedulePosition)
    emit('open')
  } catch (error) {
    close()
    reportError(error, '打开弹层失败')
  }
}

function onNativeClose() {
  const node = element.value
  if (visible && node && (node instanceof HTMLDialogElement ? !node.open : !node.matches(':popover-open'))) close()
}

watch(() => props.anchor, observeSize)
onMounted(() => {
  watch(opened, syncOpen, { immediate: true, flush: 'post' })
})
onBeforeUnmount(() => close())
</script>

<template>
  <component
    :is="mode === 'dialog' ? 'dialog' : mode === 'panel' ? 'section' : 'div'"
    ref="element"
    class="app-popup"
    :class="[`app-popup--${mode}`, { 'app-popup--group': Boolean($slots.companion) }]"
    :popover="mode === 'popover' ? 'manual' : undefined"
    role="dialog"
    :aria-modal="mode === 'dialog' ? 'true' : undefined"
    :aria-labelledby="title ? titleId : undefined"
    @cancel="onCancel"
    @close="onNativeClose"
    @toggle="onNativeClose"
  >
    <template v-if="active">
      <div class="app-popup__main">
        <header
          v-if="title || $slots['header-actions']"
          class="app-popup__header"
        >
          <h2
            v-if="title"
            :id="titleId"
          >
            {{ title }}
          </h2>
          <div class="app-popup__header-actions">
            <slot name="header-actions" />
            <button
              class="button"
              type="button"
              aria-label="关闭弹窗"
              :disabled="!dismissible"
              @click="requestClose"
            >
              ×
            </button>
          </div>
        </header>
        <slot :close="close" />
      </div>
      <slot name="companion" />
    </template>
  </component>
</template>

<style scoped>
.app-popup {
  position: fixed;
  inset: auto;
  width: min(var(--popup-width, 560px), calc(100vw - 24px));
  max-width: calc(100vw - 24px);
  max-height: calc(100dvh - 24px);
  margin: 0;
  padding: 20px;
  overflow: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--border-color);
  border-radius: 14px;
  color: var(--text-primary);
  background: var(--background-secondary);
  box-shadow: 0 16px 60px #0003;
}

.app-popup--dialog::backdrop { background: #0006; backdrop-filter: blur(4px); }
.app-popup--popover { --popup-width: 340px; padding: 0; border: 0; border-radius: 6px; background: transparent; }
.app-popup__main { min-width: 0; }
.app-popup--panel { position: relative; inset: auto; box-sizing: border-box; width: 100%; max-width: 100%; }
.app-popup--group { box-sizing: border-box; padding: 0; border: 0; background: transparent; box-shadow: none; overflow: hidden; }
.app-popup--group[open] { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(320px, 1fr); align-items: start; gap: 16px; }
.app-popup--group > .app-popup__main { box-sizing: border-box; max-height: calc(100dvh - 24px); padding: 20px; overflow: auto; border: 1px solid var(--border-color); border-radius: 14px; background: var(--background-secondary); box-shadow: 0 16px 60px #0003; }
@media (max-width: 900px) {
  .app-popup--group[open] { grid-template-columns: minmax(0, 1fr); overflow: auto; }
  .app-popup--group > .app-popup__main, .app-popup--group > :deep(.app-popup--panel) { max-height: none; }
}
.app-popup__header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.app-popup__header h2 { min-width: 0; margin: 0; overflow-wrap: anywhere; font-size: 16px; }
.app-popup__header-actions { display: flex; align-items: center; flex-shrink: 0; gap: 6px; margin-left: auto; }
.app-popup__header button { flex-shrink: 0; }
</style>
