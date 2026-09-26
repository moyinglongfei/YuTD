<script setup lang="ts">
import { requestApiData } from '~/utils/api'
import { useRead } from '~/composables/useRead'

const props = defineProps<{
  phaseId?: number
}>()

const { $api } = useNuxtApp()

const { data: events, loading, readError, refresh } = useRead(
  () => `events:${props.phaseId ?? 'all'}`,
  () => requestApiData(
    $api.api.event.get({ query: { phaseId: props.phaseId } }),
    '获取事件失败'
  )
)

function formatWeeks(weeks: unknown) {
  if (!Array.isArray(weeks))
    return '未设置'

  return weeks.filter(week => Number.isInteger(week) && week > 0).join('、') || '未设置'
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-semibold">
          事件预览
        </h2>
        <UButton
          color="neutral"
          variant="ghost"
          :loading="loading"
          :disabled="loading"
          @click="refresh()"
        >
          刷新
        </UButton>
      </div>
    </template>

    <UAlert
      v-if="readError"
      color="error"
      variant="soft"
      :title="readError"
    />
    <p
      v-else-if="loading"
      class="text-sm text-muted"
      role="status"
    >
      正在加载事件……
    </p>
    <div
      v-else-if="events?.length"
      class="space-y-4"
    >
      <article
        v-for="event in events"
        :key="event.id"
        class="space-y-4 rounded-lg border border-default p-4"
      >
        <div class="flex items-center gap-2">
          <span
            class="size-3 shrink-0 rounded-full"
            :style="{ backgroundColor: event.color || '#6366f1' }"
            aria-hidden="true"
          />
          <h3 class="font-medium">
            {{ event.name }}
          </h3>
        </div>
        <dl class="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt class="text-muted">
              所属阶段
            </dt><dd>{{ event.phase.name }}</dd>
          </div>
          <div>
            <dt class="text-muted">
              组织者
            </dt><dd>{{ event.organizer || '未设置' }}</dd>
          </div>
          <div>
            <dt class="text-muted">
              事件地点
            </dt><dd>{{ event.location || '未设置' }}</dd>
          </div>
          <div>
            <dt class="text-muted">
              关联任务
            </dt><dd>{{ event._count.tasks }} 个</dd>
          </div>
        </dl>

        <div class="space-y-2">
          <h4 class="text-sm font-medium">
            所属日程（{{ event.schedules.length }}）
          </h4>
          <ul
            v-if="event.schedules.length"
            class="space-y-2"
          >
            <li
              v-for="schedule in event.schedules"
              :key="schedule.id"
              class="space-y-1 rounded-lg bg-elevated p-3 text-sm"
            >
              <p class="font-medium">
                {{ weekdays[schedule.weekday - 1] }} · {{ schedule.startTime }}–{{ schedule.endTime }}
              </p>
              <p class="text-muted">
                周数：{{ formatWeeks(schedule.weeks) }}
              </p>
              <p class="text-muted">
                地点：{{ schedule.location || event.location || '未设置' }}
              </p>
            </li>
          </ul>
          <p
            v-else
            class="text-sm text-muted"
          >
            暂无日程。
          </p>
        </div>
      </article>
    </div>
    <p
      v-else
      class="text-sm text-muted"
    >
      暂无事件，创建后会显示在这里。
    </p>
  </UCard>
</template>
