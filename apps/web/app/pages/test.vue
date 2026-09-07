<script setup lang="ts">
import { unwrapApiData } from '~/utils/api'

const { $api } = useNuxtApp()

const { data: phase, error } = await useAsyncData('schedule-test-phase', async () => {
  const result = await $api.api.phase({ id: 6 }).get()

  if (result.error)
    throw new Error('获取测试阶段失败')
  if (!result.data)
    return null

  const phases = unwrapApiData(result.data)
  return phases
})
</script>

<template>
  <main class="min-h-screen bg-stone-100 px-4 py-10 text-slate-900 sm:px-8">
    <section class="mx-auto max-w-7xl">
      <div class="mb-6">
        <p class="text-sm font-semibold text-primary-700">
          YuTD · Schedule Test
        </p>
        <h1 class="mt-1 text-2xl font-bold tracking-tight">
          {{ phase?.name ?? '日程表测试页' }}
        </h1>
      </div>

      <p
        v-if="error"
        class="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        {{ error.message }}
      </p>
      <ScheduleTable
        v-else-if="phase"
        :phase-id="phase.id"
      />
      <p
        v-else
        class="rounded-xl bg-white px-4 py-8 text-center text-sm text-slate-500"
      >
        暂时没有可测试的阶段
      </p>
    </section>
  </main>
</template>
