<script setup lang="ts">
import EventDetail from '~/components/EventDetail.vue'
import { useRead } from '~/composables/useRead'
import { requestApiData } from '~/utils/api'

const { $api } = useNuxtApp()
const selectedEventId = ref<number | null>(null)
const detailVersion = ref(0)

const { data: events } = useRead(
  'events:all',
  () => requestApiData($api.api.event.get(), '获取课程列表失败')
)
</script>

<template>
  <main>
    <h1>课程详情测试</h1>
    <p>
      <label for="event-select">选择课程：</label>
      <select
        id="event-select"
        v-model="selectedEventId"
      >
        <option
          v-for="event in events"
          :key="event.id"
          :value="event.id"
        >
          {{ event.name }}（{{ event.phase.name }} / ID {{ event.id }}）
        </option>
      </select>
      <button
        type="button"
        @click="detailVersion++"
      >
        刷新详情
      </button>
    </p>
    <EventDetail
      v-if="selectedEventId !== null"
      :key="selectedEventId.toString() + '-' + detailVersion.toString()"
      :event-id="selectedEventId"
    />
  </main>
</template>
