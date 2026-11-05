<script setup lang="ts">
import Card from '../card/Card.vue'
import { gsap } from 'gsap'
import { TextPlugin } from 'gsap/TextPlugin'

const props = withDefaults(defineProps<{
  top: number
  height: number
  color?: string | null
  eventId: number
  eventName: string
  startTime: string
  endTime: string
  location?: string | null
  organizer?: string | null
  focused?: boolean
  focusProgress?: number
  moving?: boolean
  tips?: { id: number, content: string }[]
  editable?: boolean
}>(), { editable: true })
const { mode } = useSystemStatus()

// 向父组件传递点击事件
const emit = defineEmits<{
  select: [element: HTMLElement]
  edit: [eventId: number]
}>()

const blockStyle = computed(() => ({
  'top': `${props.top}px`,
  'height': `${props.height}px`,
  '--event-color': props.color ?? 'var(--text-primary)'
}))

function handleClick(event: MouseEvent) {
  const element = event.currentTarget

  if (!(element instanceof HTMLElement))
    return

  emit('select', element)
}
const tintColor = computed(() => props.color ?? '#FFFFFF')
function invertColor(hex: string): string {
  const color = hex.replace('#', '')

  return `#${(0xffffff ^ parseInt(color, 16))
    .toString(16)
    .padStart(6, '0')}`
}

const tColor = computed(() => invertColor(tintColor.value))
const visibleTips = computed(() => (props.tips ?? []).filter(tip => tip.content.trim()))
const progress = computed(() => props.focused ? Math.max(0, Math.min(1, props.focusProgress ?? 0)) : 0)
const tipElements = ref<HTMLElement[]>([])
const retracting = ref(false)
let typing: ReturnType<typeof gsap.timeline> | undefined
let typingTween: ReturnType<typeof gsap.to> | undefined

function clearTyping() {
  typingTween?.kill()
  typingTween = undefined
  typing?.progress(0)
  typing?.kill()
  typing = undefined
  retracting.value = false
}

function buildTyping(value = progress.value) {
  clearTyping()
  typing = gsap.timeline({ paused: true })
  const escaped = document.createElement('span')
  for (const tip of visibleTips.value) {
    const element = tipElements.value.find(element => element.dataset.tipId === String(tip.id))
    if (!element) continue
    element.textContent = ''
    escaped.textContent = tip.content
    typing.to(element, {
      text: { value: escaped.innerHTML, preserveSpaces: true },
      duration: Array.from(tip.content).length,
      ease: 'none'
    })
  }
  typing.progress(value)
}

onMounted(() => {
  gsap.registerPlugin(TextPlugin)
  watch([visibleTips, progress], ([tips, value], previous) => {
    if (!tips.length) {
      clearTyping()
    } else if (value === 0) {
      if (typing && typing.progress() > 0 && (props.focusProgress ?? 0) > 0) {
        typingTween?.kill()
        retracting.value = true
        typingTween = typing.tweenTo(0, { duration: 0.45, ease: 'power4.out', onComplete: clearTyping })
      } else {
        clearTyping()
      }
    } else if (!typing || tips !== previous?.[0]) {
      buildTyping(value === 1 ? 0 : value)
      if (value === 1) {
        typingTween = typing?.tweenTo(typing.duration(), { duration: 0.45, ease: 'power4.out' })
      }
    } else {
      typingTween?.kill()
      typingTween = undefined
      if (retracting.value && value === 1) {
        typingTween = typing.tweenTo(typing.duration(), { duration: 0.45, ease: 'power4.out' })
      } else {
        typing.progress(value < (previous?.[1] ?? value) ? Math.min(value, typing.progress()) : value)
      }
      retracting.value = false
    }
  }, { immediate: true, flush: 'post' })
})
onBeforeUnmount(clearTyping)
</script>

<template>
  <div
    class="event-block"
    :class="{ 'event-block--focused': props.focused }"
    :style="blockStyle"
    :data-event-id="eventId"
    @click.stop="handleClick"
  >
    <Card
      v-slot="{ textColor }"
      class="event-block-glass"
      :blur="2"
      :moving="moving"
      :color="tintColor"
      :tint="true"
      :tint-color="tintColor ?? 'auto'"
      :edge-tint="false"
      :edge-tint-color="tintColor ?? 'auto'"
      :outer-glow="true"
      :outer-glow-color="tintColor ?? 'auto'"
      passthrough
    >
      <slot :text-color="textColor">
        <div
          class="event-block-content"
          :style="{ color: textColor ?? undefined }"
        >
          <div class="event-block-simple">
            <span class="event-block-simple-time">
              {{ startTime }} - {{ endTime }}
            </span>
            <div class="event-block-simple-title">
              {{ eventName }}
            </div>
          </div>
          <span class="event-block-start-time">
            {{ startTime }}
          </span>
          <strong class="event-block-title">
            <slot name="title">
              {{ eventName }}
            </slot>
          </strong>
          <span
            v-if="location"
            class="event-meta event-location"
            :title="location"
          >
            {{ location }}
          </span>

          <span
            v-if="organizer"
            class="event-meta event-organizer"
            :title="organizer"
          >
            {{ organizer }}
          </span>
          <ul
            v-if="visibleTips.length"
            v-show="progress > 0 || retracting"
            class="event-block-tips"
            aria-label="事件提示"
            @click.stop
          >
            <li
              v-for="tip in visibleTips"
              :key="tip.id"
              ref="tipElements"
              :data-tip-id="tip.id"
            />
          </ul>
          <span class="event-block-end-time">
            {{ endTime }}
          </span>
        </div>
      </slot>
    </Card>
    <button
      v-if="mode === 'edit' && editable && eventId > 0"
      class="event-block-edit"
      type="button"
      :title="`编辑${eventName}`"
      :aria-label="`编辑事件：${eventName}`"
      @click.stop="emit('edit', eventId)"
    >
      <Icon
        name="lucide:pen-line"
        aria-hidden="true"
      />
    </button>
  </div>
</template>

<style scoped>
.event-block {
  position: absolute;
  z-index: 4;
  right: 0px;
  left: 0px;
  box-sizing: border-box;
  container-type: size;
  container-name: event;
  border-radius: 12px;
  border: 1px solid var(--event-color);
}
.event-block--focused {
  z-index: 4;
}
.event-block-edit {
  position: absolute;
  top: 3px;
  right: 3px;
  z-index: 5;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 3px;
  border: 1px solid var(--border-color);
  border-radius: 7px;
  color: var(--text-primary);
  background: var(--background-secondary);
  cursor: pointer;
}
.event-block-edit:hover { border-color: var(--accent-color); }
.event-block-edit:focus-visible { outline: 2px solid var(--accent-color); outline-offset: 2px; }
.event-block-glass {
  width: 100%;
  height: 100%;
}
/* 事件的具体内容 */
.event-block-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
  justify-content: center;
  align-items: center;
}
.event-block-start-time,
.event-block-end-time {
  left: 0;
  right: 0;
  padding: 1px 0px;
  font-size: clamp(8px, 13cqi, 11px);
  color: var(--card-text-color, v-bind(tColor));
}
.event-block-simple-time,
.event-block-simple-title{
  left: 0;
  right: 0;
  font-size: clamp(6px, 7cqi, 13px);
  color: var(--card-text-color, var(--event-color));
}
.event-block-end-time {
  margin-top: auto;
  flex-shrink: 0;
}
.event-block-title {
  min-width: 0;
  font-size: clamp(10px, min(10cqi, 40cqb), 20px);
  overflow: hidden;
  overflow-wrap: anywhere;
  line-height: 1.2;
}
.event-block-tips {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  box-sizing: border-box;
  overflow-y: auto;
  overscroll-behavior: contain;
  margin: 6px 0;
  padding: 0 10px;
  list-style: none;
  font-size: clamp(10px, 4cqi, 13px);
  line-height: 1.45;
  text-align: left;
  user-select: text;
}
.event-block-tips li {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.event-block-tips li:empty { display: none; }
.event-block-tips li + li {
  margin-top: 6px;
}
.event-meta {
  overflow: hidden;
  text-overflow: ellipsis;
  display: none;
}
.event-block-simple {
  display: flex;
  align-items: center;
  gap: 3px;
  max-width: 100%;
  min-width: 0;
}
.event-block-simple-time {
  display: none;
  flex-shrink: 0;
}
.event-block-simple-title {
  display: none;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.event-location {
    font-size: clamp(9px, min(16cqi, 16cqb), 15px);
}
.event-organizer {
    font-size: clamp(9px, min(9cqi, 10cqb), 15px);
}
@container event (min-width: 40px) and (min-height: 80px) {
  .event-location {
    display: block;
  }
}

@container event (min-width: 60px) and (min-height: 90px) {
  .event-organizer {
    display: block;
  }
}
@container event (max-height: 60px) {
  .event-block-simple {
    padding: 1px 4px;
  }
  .event-block-simple-time {
    display: flex;
    width: 100%;
    justify-content: center;
  }
  .event-block-start-time,
  .event-block-end-time {
    display: none;
  }
}
@container event (max-height: 40px) {
  .event-block-simple-time {
    width: auto;
  }
  .event-block-title {
    display: none;
  }
  .event-block-simple-title {
    display: flex;
  }
}
@container event (max-width: 50px) {
  .event-block-simple-title {
    display: none;
  }
  .event-block-simple-time {
    width: 100%;
    justify-content: center;
  }
}
@container event (max-height: 18px) {
  .event-block-content {
    background-color: var(--event-color);
  }
  .event-block-simple {
    transform: translateY(-14px);
  }
}
</style>
