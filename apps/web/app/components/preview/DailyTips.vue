<script setup lang="ts">
import { computed, getCurrentScope, shallowReactive, watch } from 'vue'
import type { Ref } from 'vue'
import { dailyTipDateKey, visibleDailyTips } from '~/utils/dailyTips'

type Task = ApiData<Api['api']['task']['get']>[number]

const props = defineProps<{ phaseId?: number, date?: string }>()
const { now, timeZone } = useSystemTime()
const day = computed(() => props.date || (now.value ? calendarDate(now.value, timeZone.value) : ''))
const client = useApi({
  key: () => `dailytips:v2:${props.phaseId ?? 'all'}:${day.value || 'pending'}:${timeZone.value}`,
  read: async api => !day.value ? null : api.api.dailytips.get({ query: { phase: props.phaseId, date: day.value } })
})
const { data, pending, refresh } = useAsyncData(client.key, client.read, { deep: true })
const app = useNuxtApp()
const scope = getCurrentScope()
const taskCaches = shallowReactive(new Map<number, Ref<Task[] | undefined>>())
// 只订阅已有任务缓存，完成、撤销和延期后直接重算，不额外请求全部任务。
watch(() => data.value?.tasks, (tasks) => {
  for (const task of tasks ?? []) {
    if (!taskCaches.has(task.phaseId)) {
      scope?.run(() => {
        app.runWithContext(() => {
          taskCaches.set(task.phaseId, useNuxtData<Task[]>(`tasks:${task.phaseId}:all`).data)
        })
      })
    }
  }
}, { immediate: true, flush: 'sync' })
const tips = computed(() => {
  const snapshot = data.value
  if (!snapshot || dailyTipDateKey(snapshot.date) !== day.value) return []
  const tasks = snapshot.tasks.map(task => taskCaches.get(task.phaseId)?.value?.find(value => value.id === task.id) ?? task)
  const date = now.value && calendarDate(now.value, timeZone.value) === day.value
    ? now.value
    : parseZonedDateTime(day.value, timeZone.value)
  return visibleDailyTips(snapshot.tips, tasks, snapshot.occurrences, day.value, date, timeZone.value, props.phaseId)
})
function tipTime(time: number | null) {
  if (time === null) return '全天'
  return new Intl.DateTimeFormat('zh-CN', { timeZone: timeZone.value, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(time)
}
</script>

<template>
  <section
    class="daily-tips"
    aria-label="每日提示"
  >
    <header class="daily-tips__header">
      <h2>每日提示</h2>
      <span class="daily-tips__date">{{ day }}</span>
      <button
        class="button"
        type="button"
        :disabled="pending || !day"
        @click="refresh()"
      >
        {{ pending ? '加载中……' : '刷新' }}
      </button>
    </header>
    <ul
      v-if="tips.length"
      class="daily-tips__list"
    >
      <li
        v-for="tip in tips"
        :key="tip.id"
        class="daily-tips__tip"
      >
        <div class="daily-tips__timing">
          <time :datetime="tip.time === null ? undefined : new Date(tip.time).toISOString()">{{ tipTime(tip.time) }}</time>
          <span v-if="tip.ongoing">进行中</span>
          <span v-else-if="tip.overdue">已过时 · 待处理</span>
        </div>
        <div class="daily-tips__content">
          <p>{{ tip.content }}</p>
          <span
            v-if="tip.sources.length"
            class="daily-tips__sources"
          >{{ tip.sources.join('、') }}</span>
        </div>
      </li>
    </ul>
    <p
      v-else-if="!data"
      class="daily-tips__empty"
      role="status"
    >
      {{ !day || pending ? '正在加载每日提示……' : '每日提示尚未载入，请重新加载。' }}
    </p>
    <p
      v-else
      class="daily-tips__empty"
      role="status"
    >
      今天暂无提示。
    </p>
  </section>
</template>

<style scoped>
.daily-tips {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
}
.daily-tips__header {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 7px;
}
.daily-tips__header h2 {
  margin: 0;
  font-size: 13px;
}
.daily-tips__date {
  margin-left: auto;
  color: var(--text-secondary);
  font-size: 12px;
}
.daily-tips__list {
  min-height: 0;
  overflow-y: auto;
  margin: 0;
  padding: 0;
  list-style: none;
}
.daily-tips__tip {
  display: flex;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-color);
  font-size: 12px;
}
.daily-tips__timing {
  display: flex;
  flex: 0 0 90px;
  flex-direction: column;
  gap: 4px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}
.daily-tips__content {
  min-width: 0;
  overflow-wrap: anywhere;
}
.daily-tips__content p {
  margin: 0 0 4px;
  white-space: pre-wrap;
}
.daily-tips__sources,
.daily-tips__empty {
  color: var(--text-secondary);
  font-size: 12px;
}
.daily-tips__empty {
  margin: 0;
}
</style>
