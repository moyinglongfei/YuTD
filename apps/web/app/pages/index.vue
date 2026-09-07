<script setup lang="ts">
const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const hours = Array.from({ length: 11 }, (_, index) => index + 8)

const previewEvent = {
  id: 1,
  name: '数据结构',
  organizer: '计算机学院',
  location: 'B2-301',
  color: '#7c3aed',
  phaseId: 1,
  weekday: 3,
  startTime: '09:30',
  endTime: '11:10',
  weeks: [1, 2, 3, 4, 5, 6, 7, 8],
  createdAt: new Date(),
  updatedAt: new Date()
}
</script>

<template>
  <main class="min-h-screen bg-stone-100 px-4 py-10 text-slate-900 sm:px-8">
    <section class="mx-auto max-w-6xl">
      <div class="mb-6">
        <p class="text-sm font-semibold text-primary-700">
          YuTD · Event Block
        </p>
        <h1 class="mt-1 text-2xl font-bold tracking-tight">
          事件方框基础预览
        </h1>
        <p class="mt-2 text-sm text-slate-600">
          当前根据星期、开始时间和结束时间自动计算位置与高度。
        </p>
      </div>

      <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div class="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-slate-200 bg-slate-50">
          <div />
          <div
            v-for="weekday in weekdays"
            :key="weekday"
            class="border-l border-slate-200 px-2 py-3 text-center text-xs font-semibold text-slate-600"
          >
            {{ weekday }}
          </div>
        </div>

        <div class="grid grid-cols-[64px_minmax(0,1fr)]">
          <div class="relative h-[720px] border-r border-slate-200 bg-slate-50/70">
            <span
              v-for="hour in hours"
              :key="hour"
              class="absolute right-3 -translate-y-1/2 text-[11px] tabular-nums text-slate-400"
              :style="{ top: `${(hour - 8) * 72}px` }"
            >
              {{ String(hour).padStart(2, '0') }}:00
            </span>
          </div>

          <div class="relative h-[720px] overflow-hidden">
            <div class="pointer-events-none absolute inset-0 grid grid-cols-7 divide-x divide-slate-100">
              <div
                v-for="weekday in weekdays"
                :key="weekday"
              />
            </div>
            <div
              v-for="hour in hours"
              :key="hour"
              class="pointer-events-none absolute inset-x-0 border-t border-slate-100"
              :style="{ top: `${(hour - 8) * 72}px` }"
            />

            <EventBlock
              v-bind="previewEvent"
              day-end="18:00"
            />
          </div>
        </div>
      </div>
    </section>
  </main>
</template>
