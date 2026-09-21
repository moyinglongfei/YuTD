<script setup lang="ts">
import { requestApiData } from '~/utils/api'

const props = defineProps<{
  eventId: number
}>()

// 数据获取
const { $api } = useNuxtApp()

const event = await requestApiData(
  $api.api.event({ id: props.eventId }).get(),
  '获取事件失败'
)

const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const schedules = [...(event?.schedules ?? [])].sort((a, b) =>
  a.weekday - b.weekday || a.startTime.localeCompare(b.startTime)
)

function formatWeeks(weeks: unknown) {
  if (!Array.isArray(weeks))
    return '未设置'

  return weeks.filter(week => Number.isInteger(week) && week > 0)
    .sort((a, b) => a - b).join('、') || '未设置'
}
</script>

<template>
  <section aria-label="课程详情">
    <h2>{{ event.name }}</h2>
    <dl>
      <dt>课程 ID</dt>
      <dd>{{ event.id }}</dd>
      <dt>所属阶段</dt>
      <dd>{{ event.phase.name }}</dd>
      <dt>组织者</dt>
      <dd>{{ event.organizer || '未设置' }}</dd>
      <dt>默认地点</dt>
      <dd>{{ event.location || '未设置' }}</dd>
      <dt>课程颜色</dt>
      <dd>{{ event.color || '未设置' }}</dd>
      <dt>关联任务</dt>
      <dd>{{ event._count.tasks }} 个</dd>
    </dl>

    <h3>时间表（{{ schedules.length }}）</h3>
    <table v-if="schedules.length">
      <thead>
        <tr>
          <th scope="col">
            星期
          </th>
          <th scope="col">
            开始时间
          </th>
          <th scope="col">
            结束时间
          </th>
          <th scope="col">
            周数
          </th>
          <th scope="col">
            地点
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="schedule in schedules"
          :key="schedule.id"
        >
          <td>{{ weekdays[schedule.weekday - 1] }}</td>
          <td>{{ schedule.startTime }}</td>
          <td>{{ schedule.endTime }}</td>
          <td>{{ formatWeeks(schedule.weeks) }}</td>
          <td>{{ schedule.location || event.location || '未设置' }}</td>
        </tr>
      </tbody>
    </table>
    <p v-else>
      暂无时间安排。
    </p>

    <h3>Tips（{{ event.tips.length }}）</h3>
    <ul v-if="event.tips.length">
      <li
        v-for="tip in event.tips"
        :key="tip.id"
      >
        {{ tip.content }}
      </li>
    </ul>
    <p v-else>
      暂无提示。
    </p>
  </section>
</template>
