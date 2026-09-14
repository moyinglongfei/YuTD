<script setup lang="ts">
import { requestApiData } from '~/utils/api'
import { useRead } from '~/composables/useRead'

const props = defineProps<{
  selectedId?: number
}>()

const emit = defineEmits<{
  select: [phaseId: number]
}>()

const { $api } = useNuxtApp()

const { data: phases, loading, readError, refresh } = useRead('phases', () =>
  requestApiData($api.api.phase.get(), '获取阶段失败')
)
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-semibold">
          阶段预览
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
      正在加载阶段……
    </p>
    <div
      v-else-if="phases?.length"
      class="grid gap-4 sm:grid-cols-2"
    >
      <article
        v-for="phase in phases"
        :key="phase.id"
        class="space-y-3 rounded-lg border border-default p-4"
      >
        <div class="flex items-center justify-between gap-3">
          <h3 class="font-medium">
            {{ phase.name }}
          </h3>
          <UBadge
            v-if="phase.id === props.selectedId"
            variant="soft"
          >
            当前阶段
          </UBadge>
        </div>
        <p class="text-sm text-muted">
          <NuxtTime
            :datetime="phase.startDate"
            locale="zh-CN"
            time-zone="UTC"
            year="numeric"
            month="2-digit"
            day="2-digit"
          />
          至
          <NuxtTime
            :datetime="phase.endDate"
            locale="zh-CN"
            time-zone="UTC"
            year="numeric"
            month="2-digit"
            day="2-digit"
          />
        </p>
        <div class="flex flex-wrap gap-2">
          <UBadge
            color="neutral"
            variant="soft"
          >
            {{ phase.weekCount }} 周
          </UBadge>
          <UBadge
            color="neutral"
            variant="soft"
          >
            {{ phase._count.events }} 个事件
          </UBadge>
          <UBadge
            color="neutral"
            variant="soft"
          >
            {{ phase._count.tasks }} 个任务
          </UBadge>
        </div>
        <UButton
          color="neutral"
          variant="outline"
          size="sm"
          :disabled="phase.id === props.selectedId"
          @click="emit('select', phase.id)"
        >
          查看此阶段
        </UButton>
      </article>
    </div>
    <p
      v-else
      class="text-sm text-muted"
    >
      暂无阶段，创建后会显示在这里。
    </p>
  </UCard>
</template>
