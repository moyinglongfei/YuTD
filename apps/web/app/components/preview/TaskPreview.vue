<script setup lang="ts">
import { requestApiData } from '~/utils/api'
import { useRead } from '~/composables/useRead'

const props = defineProps<{
  phaseId?: number
  eventId?: number
}>()

const { $api } = useNuxtApp()

const { data: tasks, loading, readError, refresh } = useRead(
  () => `tasks:${props.phaseId ?? 'all'}:${props.eventId ?? 'all'}`,
  () => requestApiData(
    $api.api.task.get({ query: { phaseId: props.phaseId, eventId: props.eventId } }),
    '获取任务失败'
  )
)

const statuses = {
  TODO: { label: '待办', color: 'neutral' },
  DOING: { label: '进行中', color: 'info' },
  DONE: { label: '已完成', color: 'success' },
  CANCELLED: { label: '已取消', color: 'warning' }
} as const
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-semibold">
          任务预览
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
      正在加载任务……
    </p>
    <div
      v-else-if="tasks?.length"
      class="space-y-4"
    >
      <article
        v-for="task in tasks"
        :key="task.id"
        class="space-y-3 rounded-lg border border-default p-4"
      >
        <div class="flex items-start justify-between gap-3">
          <h3 class="font-medium">
            {{ task.title }}
          </h3>
          <UBadge
            :color="statuses[task.status].color"
            variant="soft"
            class="shrink-0"
          >
            {{ statuses[task.status].label }}
          </UBadge>
        </div>
        <p
          v-if="task.description"
          class="whitespace-pre-line text-sm text-muted"
        >
          {{ task.description }}
        </p>
        <dl class="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt class="text-muted">
              所属阶段
            </dt><dd>{{ task.phase.name }}</dd>
          </div>
          <div>
            <dt class="text-muted">
              关联事件
            </dt><dd>{{ task.event?.name || '未关联' }}</dd>
          </div>
          <div>
            <dt class="text-muted">
              优先级
            </dt><dd>{{ task.priority }}</dd>
          </div>
          <div>
            <dt class="text-muted">
              截止时间（UTC+8）
            </dt>
            <dd>
              <NuxtTime
                v-if="task.dueDate"
                :datetime="task.dueDate"
                locale="zh-CN"
                time-zone="Asia/Hong_Kong"
                year="numeric"
                month="2-digit"
                day="2-digit"
                hour="2-digit"
                minute="2-digit"
                :hour12="false"
              />
              <span v-else>未设置</span>
            </dd>
          </div>
        </dl>
        <div
          v-if="task.tags.length"
          class="flex flex-wrap gap-2"
        >
          <UBadge
            v-for="tag in task.tags"
            :key="tag.id"
            color="neutral"
            variant="soft"
          >
            {{ tag.name }}
          </UBadge>
        </div>
        <div
          v-if="task.reminders.length"
          class="space-y-1 text-sm"
        >
          <h4 class="font-medium">
            提醒时间（UTC+8）
          </h4>
          <ul class="space-y-1 text-muted">
            <li
              v-for="reminder in task.reminders"
              :key="reminder.id"
            >
              <NuxtTime
                :datetime="reminder.time"
                locale="zh-CN"
                time-zone="Asia/Hong_Kong"
                year="numeric"
                month="2-digit"
                day="2-digit"
                hour="2-digit"
                minute="2-digit"
                :hour12="false"
              />
            </li>
          </ul>
        </div>
      </article>
    </div>
    <p
      v-else
      class="text-sm text-muted"
    >
      暂无任务，创建后会显示在这里。
    </p>
  </UCard>
</template>
