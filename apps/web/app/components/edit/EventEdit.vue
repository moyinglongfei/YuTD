<script setup lang="ts">
import EventBlock from '../preview/Event/EventBlock.vue'
import WeekPicker from '../common/WeekPicker.vue'
import Background from '../image/BackgroundLayout.vue'
import BackgroundSelect, { type BackgroundSelection } from '../image/BackgroundSelect.vue'
import { CardStyleKey } from '../preview/card/cardMaterial'
import { weekdays } from '~/utils/date'
import { getScheduleData, parseWeeks } from '~/utils/schedule'

export interface EditableSchedule {
  id: number
  weekday: number
  startTime: string
  endTime: string
  weeks: unknown
  location: string | null
  organizer: string | null
}

export interface EditableEvent {
  id: number
  phaseId: number
  name: string
  location: string | null
  organizer: string | null
  color: string | null
  schedules: EditableSchedule[]
}

const props = withDefaults(defineProps<{
  event?: EditableEvent | null
  phaseId: number
  weekCount: number
  allowNew?: boolean
}>(), { allowNew: true })
const theme = inject(CardStyleKey, undefined)
const fancy = computed(() => theme?.value.showMode === 1)
const backgroundSelection = shallowRef<BackgroundSelection | null>(null)
const backgroundPending = ref(true)
watch([fancy, () => props.phaseId], () => {
  backgroundSelection.value = null
  backgroundPending.value = true
})
const emit = defineEmits<{
  'saved': [event: EditableEvent]
  'new': []
  'add-task': [event: EditableEvent]
}>()
const activeEvent = shallowRef<EditableEvent | null>(null)
const eventForm = reactive({ name: '', location: '', organizer: '', color: '#172033' as string | null })
const scheduleForm = reactive({ weekday: 1, weeks: [] as number[], startTime: '', endTime: '', location: '', organizer: '' })
const selectedScheduleId = ref<number | null>(null)
const saving = ref<'event' | 'schedule' | null>(null)
const eventError = ref('')
const scheduleError = ref('')
const element = ref<HTMLElement | null>(null)
let revision = 0
const eventColor = computed({
  get: () => eventForm.color ?? '#172033',
  set: (value: string) => { eventForm.color = value }
})
const schedules = computed(() => activeEvent.value?.schedules ?? [])

function selectSchedule(schedule?: EditableSchedule) {
  selectedScheduleId.value = schedule?.id ?? null
  Object.assign(scheduleForm, {
    weekday: schedule?.weekday ?? 1,
    weeks: parseWeeks(schedule?.weeks),
    startTime: schedule?.startTime ?? '',
    endTime: schedule?.endTime ?? '',
    location: schedule?.location ?? '',
    organizer: schedule?.organizer ?? ''
  })
  scheduleError.value = ''
}

function loadEvent(event: EditableEvent | null) {
  revision++
  saving.value = null
  // 只编辑副本，初始值和排课的周数数组都不回写父组件。
  activeEvent.value = event ? { ...event, schedules: event.schedules.map(schedule => ({ ...schedule, weeks: parseWeeks(schedule.weeks) })) } : null
  Object.assign(eventForm, {
    name: event?.name ?? '', location: event?.location ?? '', organizer: event?.organizer ?? '', color: event ? event.color : '#172033'
  })
  eventError.value = ''
  selectSchedule(activeEvent.value?.schedules[0])
}

watch([() => props.event, () => props.phaseId], ([event, phaseId], previous) => {
  if (previous && phaseId === previous[1] && event?.id === activeEvent.value?.id) return
  loadEvent(event ?? null)
}, { immediate: true })

function startNew() {
  loadEvent(null)
  emit('new')
}

function eventData() {
  const name = eventForm.name.trim()
  if (!name) throw new Error('请输入事件名称')
  return { name, location: eventForm.location.trim(), organizer: eventForm.organizer.trim(), color: eventForm.color ?? undefined }
}

function scheduleData() {
  if (!scheduleForm.weeks.length) throw new Error('请至少选择一周')
  const value = getScheduleData({ ...scheduleForm, weeks: scheduleForm.weeks.join(',') })
  if (value.weeks.some(week => week > props.weekCount)) throw new Error(`周数不能超过所属阶段的 ${props.weekCount} 周`)
  return { ...value, location: scheduleForm.location.trim(), organizer: scheduleForm.organizer.trim() }
}

type ScheduleData = ReturnType<typeof scheduleData>
const eventClient = useApi({
  key: () => `event:${activeEvent.value?.id ?? 'new'}`,
  write: (api, value: { data: ReturnType<typeof eventData>, schedule?: ScheduleData }) => activeEvent.value
    ? api.api.event({ id: activeEvent.value.id }).patch(value.data)
    : api.api.event.post({ ...value.data, phaseId: props.phaseId, schedules: value.schedule ? [value.schedule] : [] })
})
const scheduleClient = useApi({
  key: () => `event-schedules:${activeEvent.value?.id ?? 'new'}`,
  write: (api, value: { id: number | null, eventId: number, data: ScheduleData }) => value.id === null
    ? api.api['event-schedule'].post({ ...value.data, eventId: value.eventId })
    : api.api['event-schedule']({ id: value.id }).patch(value.data)
})

async function saveEvent() {
  if (saving.value) return
  const current = revision
  eventError.value = ''
  try {
    const data = eventData()
    saving.value = 'event'
    const saved = await eventClient.write({ data })
    if (current !== revision) return
    activeEvent.value = saved
    Object.assign(eventForm, { name: saved.name, location: saved.location ?? '', organizer: saved.organizer ?? '', color: saved.color })
    emit('saved', saved)
  } catch (error) {
    if (current === revision) eventError.value = error instanceof Error ? error.message : '保存事件失败，请重试。'
  } finally {
    if (current === revision) saving.value = null
  }
}

async function saveSchedule() {
  if (saving.value) return
  const current = revision
  scheduleError.value = ''
  try {
    const data = scheduleData()
    // 新事件的第一条排课通过现有嵌套创建接口一次保存。
    const initialData = activeEvent.value ? null : eventData()
    saving.value = 'schedule'
    if (initialData) {
      const saved = await eventClient.write({ data: initialData, schedule: data })
      if (current !== revision) return
      activeEvent.value = saved
      Object.assign(eventForm, { name: saved.name, location: saved.location ?? '', organizer: saved.organizer ?? '', color: saved.color })
      selectSchedule(saved.schedules[0])
      emit('saved', saved)
    } else {
      const event = activeEvent.value!
      const schedule = await scheduleClient.write({ id: selectedScheduleId.value, eventId: event.id, data })
      if (current !== revision) return
      const next = selectedScheduleId.value === null
        ? [...event.schedules, schedule]
        : event.schedules.map(item => item.id === schedule.id ? schedule : item)
      const saved = { ...event, schedules: next }
      activeEvent.value = saved
      selectSchedule(schedule)
      emit('saved', saved)
    }
  } catch (error) {
    if (current === revision) scheduleError.value = error instanceof Error ? error.message : '保存排课失败，请重试。'
  } finally {
    if (current === revision) saving.value = null
  }
}

defineExpose({ saving, focus: () => element.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }) })
</script>

<template>
  <section
    ref="element"
    class="edit-event item-card"
    :class="{ 'edit-event--fancy': fancy }"
  >
    <header class="edit-event__heading">
      <h2 class="panel-title">
        {{ activeEvent ? '编辑事件' : '新建事件' }}
      </h2>
      <div class="edit-event__heading-actions">
        <button
          v-if="activeEvent"
          class="button"
          type="button"
          :disabled="Boolean(saving)"
          @click="emit('add-task', activeEvent)"
        >
          <Icon
            name="lucide:plus"
            aria-hidden="true"
          />添加任务
        </button>
        <button
          v-if="activeEvent && allowNew"
          class="button"
          type="button"
          :disabled="Boolean(saving)"
          @click="startNew"
        >
          新建事件
        </button>
      </div>
    </header>
    <div
      v-if="fancy"
      hidden
    >
      <BackgroundSelect
        :key="phaseId"
        :background-key="`schedule:${phaseId}`"
        @change="backgroundSelection = $event"
        @loading-change="backgroundPending = $event"
      />
    </div>
    <Background
      class="edit-event__background"
      :pending="fancy && backgroundPending"
      :image="fancy ? backgroundSelection?.image ?? '/images/bg.png' : ''"
      :position="fancy ? backgroundSelection?.position : undefined"
      :simplified-image="fancy ? backgroundSelection?.simplifiedImage : undefined"
      :analysis="fancy ? backgroundSelection?.analysis : undefined"
    >
      <div class="edit-event__layout">
        <div class="edit-event__schedules">
          <div
            v-if="schedules.length"
            class="edit-event__existing"
            aria-label="已有排课"
          >
            <article
              v-for="schedule in schedules"
              :key="schedule.id"
              class="edit-event__schedule-row"
              :class="{ 'edit-event__schedule-row--selected': selectedScheduleId === schedule.id }"
            >
              <button
                class="edit-event__schedule-select"
                type="button"
                :disabled="Boolean(saving)"
                :aria-pressed="selectedScheduleId === schedule.id"
                :aria-label="`编辑${weekdays[schedule.weekday - 1]} ${schedule.startTime}–${schedule.endTime}的排课`"
                @click="selectSchedule(schedule)"
              >
                <span>{{ weekdays[schedule.weekday - 1] }}</span>
                <strong>{{ schedule.startTime }}–{{ schedule.endTime }}</strong>
                <Icon
                  name="lucide:pen-line"
                  aria-hidden="true"
                />
              </button>
              <WeekPicker
                :model-value="parseWeeks(schedule.weeks)"
                :color="eventColor"
              />
            </article>
          </div>

          <form
            class="panel-stack edit-event__schedule-form"
            @submit.prevent="saveSchedule"
          >
            <div class="edit-event__heading">
              <h3 class="item-title">
                {{ selectedScheduleId === null ? '新增排课' : '编辑排课' }}
              </h3>
              <button
                v-if="selectedScheduleId !== null"
                class="button"
                type="button"
                :disabled="Boolean(saving)"
                @click="selectSchedule()"
              >
                新增排课
              </button>
            </div>
            <fieldset
              class="panel-stack"
              :disabled="Boolean(saving)"
            >
              <div class="form-field">
                <span>星期 · {{ weekdays[scheduleForm.weekday - 1] }}</span>
                <WeekPicker
                  :model-value="[scheduleForm.weekday]"
                  :count="7"
                  :color="eventColor"
                  aria-label="排课星期，1 至 7 对应周一至周日"
                  selectable
                  exclusive
                  @update:model-value="scheduleForm.weekday = $event[0] ?? 1"
                />
              </div>
              <details
                class="edit-event__weeks"
                open
              >
                <summary>周数 · 已选择 {{ scheduleForm.weeks.length }} 周</summary>
                <WeekPicker
                  v-model="scheduleForm.weeks"
                  :count="weekCount"
                  :color="eventColor"
                  selectable
                />
                <div class="edit-event__week-actions">
                  <button
                    class="button"
                    type="button"
                    @click="scheduleForm.weeks = Array.from({ length: weekCount }, (_, index) => index + 1)"
                  >
                    全选
                  </button>
                  <button
                    class="button"
                    type="button"
                    @click="scheduleForm.weeks = []"
                  >
                    清空
                  </button>
                </div>
              </details>
              <label class="form-field">
                <span>本次地点</span>
                <input
                  v-model="scheduleForm.location"
                  class="form-control"
                  :placeholder="eventForm.location || '留空使用默认地点'"
                  aria-label="本次地点"
                >
              </label>
              <label class="form-field">
                <span>本次授课 / 组织者</span>
                <input
                  v-model="scheduleForm.organizer"
                  class="form-control"
                  :placeholder="eventForm.organizer || '留空使用默认授课人'"
                  aria-label="本次授课人"
                >
              </label>
              <div class="edit-event__times">
                <label class="form-field">
                  <span>开始时间</span>
                  <input
                    v-model="scheduleForm.startTime"
                    class="form-control"
                    type="time"
                    aria-label="排课开始时间"
                    required
                  >
                </label>
                <label class="form-field">
                  <span>结束时间</span>
                  <input
                    v-model="scheduleForm.endTime"
                    class="form-control"
                    type="time"
                    aria-label="排课结束时间"
                    required
                  >
                </label>
              </div>
            </fieldset>
            <p
              v-if="scheduleError"
              class="edit-event__error"
              role="alert"
            >
              {{ scheduleError }}
            </p>
            <button
              class="button button--primary edit-event__submit"
              type="submit"
              :disabled="Boolean(saving)"
            >
              {{ saving === 'schedule' ? '正在保存……' : selectedScheduleId === null ? '添加排课' : '保存排课' }}
            </button>
          </form>
        </div>

        <EventBlock
          v-slot="{ textColor }"
          class="edit-event__event-block"
          :top="0"
          :height="440"
          :event-id="activeEvent?.id ?? 0"
          :event-name="eventForm.name || '新建事件'"
          :color="eventColor"
          :start-time="scheduleForm.startTime"
          :end-time="scheduleForm.endTime"
          :editable="false"
        >
          <form
            class="edit-event__event-form"
            :style="{ color: textColor ?? 'var(--text-primary)' }"
            @submit.prevent="saveEvent"
          >
            <fieldset
              class="panel-stack"
              :disabled="Boolean(saving)"
            >
              <label class="form-field">
                <span>事件名称</span>
                <input
                  v-model="eventForm.name"
                  class="form-control edit-event__name"
                  placeholder="事件名称"
                  aria-label="事件名称"
                  required
                >
              </label>
              <label class="form-field">
                <span>默认地点</span>
                <input
                  v-model="eventForm.location"
                  class="form-control"
                  placeholder="选填"
                  aria-label="默认地点"
                >
              </label>
              <label class="form-field">
                <span>默认授课 / 组织者</span>
                <input
                  v-model="eventForm.organizer"
                  class="form-control"
                  placeholder="选填"
                  aria-label="默认授课人"
                >
              </label>
              <label class="edit-event__color">
                <span>事件颜色</span>
                <input
                  v-model="eventColor"
                  type="color"
                  aria-label="事件颜色"
                >
              </label>
            </fieldset>
            <p
              v-if="eventError"
              class="edit-event__event-error"
              role="alert"
            >
              {{ eventError }}
            </p>
            <button
              class="button edit-event__event-submit"
              type="submit"
              :disabled="Boolean(saving)"
            >
              {{ saving === 'event' ? '正在保存……' : activeEvent ? '保存事件' : '创建事件' }}
            </button>
          </form>
        </EventBlock>
      </div>
    </Background>
  </section>
</template>

<style scoped>
.edit-event { min-width: 0; container: edit-event / inline-size; scroll-margin-top: 16px; }
.edit-event__heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.edit-event__heading h2, .edit-event__heading h3 { margin: 0; }
.edit-event__heading-actions { display: flex; align-items: center; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.edit-event > .edit-event__background { height: auto; overflow: clip; border-radius: 12px; }
.edit-event--fancy .edit-event__layout { padding: 16px; }
.edit-event--fancy .edit-event__schedules { padding: 16px; border-radius: 12px; background: color-mix(in srgb, var(--background-secondary) 94%, transparent); }
.edit-event__layout { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(220px, 1fr); align-items: start; gap: 24px; }
.edit-event__schedules { min-width: 0; }
.edit-event__existing { display: grid; gap: 8px; margin-bottom: 20px; }
.edit-event__schedule-row { display: grid; gap: 8px; padding: 12px; border: 1px solid var(--border-color); border-radius: 10px; }
.edit-event__schedule-row--selected { border-color: var(--accent-color); background: color-mix(in srgb, var(--accent-color) 8%, transparent); }
.edit-event__schedule-select { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; min-width: 0; padding: 0; border: 0; background: transparent; color: var(--text-primary); font: inherit; cursor: pointer; }
.edit-event__schedule-select strong { font-variant-numeric: tabular-nums; }
.edit-event__schedule-select:focus-visible { outline: 2px solid var(--accent-color); outline-offset: 4px; }
.edit-event__schedule-form > .edit-event__heading { margin-bottom: 0; }
.edit-event__weeks { display: grid; min-width: 0; }
.edit-event__weeks summary { margin-bottom: 12px; cursor: pointer; font-size: 13px; }
.edit-event__week-actions { display: flex; gap: 8px; margin-top: 10px; }
.edit-event__week-actions .button { min-height: 28px; padding: 3px 8px; font-size: 12px; }
.edit-event__times { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.edit-event__submit { justify-self: end; }
.edit-event .edit-event__event-block { position: relative; left: auto; right: auto; min-width: 0; width: 100%; }
.edit-event__event-form { display: flex; flex-direction: column; gap: 16px; height: 100%; padding: 20px; overflow-y: auto; }
.edit-event__event-form .form-field { color: inherit; }
.edit-event__event-form .form-control { background: transparent; border-color: color-mix(in srgb, currentColor 35%, transparent); color: inherit; }
.edit-event__event-form .form-control::placeholder { color: inherit; opacity: .6; }
.edit-event__event-form .form-control:focus-visible { outline-color: currentColor; }
.edit-event__name { font-weight: 700; }
.edit-event__color { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 13px; }
.edit-event__color input { width: 44px; height: 36px; padding: 2px; border: 1px solid currentColor; border-radius: 8px; background: transparent; cursor: pointer; }
.edit-event__event-submit { align-self: flex-end; margin-top: auto; border-color: currentColor; background: transparent; color: inherit; }
.edit-event__event-submit:hover:not(:disabled) { background: color-mix(in srgb, currentColor 12%, transparent); }
.edit-event__error { margin: 0; color: #b91c1c; font-size: 13px; }
.edit-event__event-error { margin: 0; color: inherit; font-size: 13px; }
@container edit-event (width < 640px) {
  .edit-event__layout { grid-template-columns: minmax(0, 1fr); }
  .edit-event__event-block { grid-row: 1; }
}
</style>
