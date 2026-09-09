<script setup lang="ts">
import { requestApiData } from '~/utils/api'

const props = defineProps<{
  phaseId: number
}>()

const { $api } = useNuxtApp()

const [events, tasks] = await Promise.all([
  requestApiData(
    $api.api.event.get({ query: { phaseId: props.phaseId } }),
    '获取事件失败'
  ),
  requestApiData(
    $api.api.task.get({ query: { phaseId: props.phaseId } }),
    '获取任务失败'
  )
])

// 计算日程表的开始时间和结束时间
function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number) as [number, number]
  return hours * 60 + minutes
}
function dateToMinutes(date: Date) {
  const d = new Date(date)
  return d.getHours() * 60 + d.getMinutes()
}
function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins
    .toString()
    .padStart(2, '0')}`
}
const schedules = events.flatMap(event => event.schedules)
const dueTimes = tasks.flatMap(task => task.dueDate)
const plannedTimes = tasks.flatMap(task => task.plannedDate)
const startMinutes: number[] = []
const endMinutes: number[] = []
for (const schedule of schedules) {
  if (schedule.startTime && schedule.endTime) {
    startMinutes.push(timeToMinutes(schedule.startTime))
    endMinutes.push(timeToMinutes(schedule.endTime))
  }
}
for (const dueTime of dueTimes) {
  if (dueTime) {
    endMinutes.push(dateToMinutes(dueTime))
  }
}
for (const plannedTime of plannedTimes) {
  if (plannedTime) {
    startMinutes.push(dateToMinutes(plannedTime))
  }
}
const miniStartMinutes = startMinutes.length ? Math.min(...startMinutes) : 8 * 60
const maxEndMinutes = endMinutes.length ? Math.max(...endMinutes) : 22 * 60
const scheduleStartTime = minutesToTime(Math.floor(miniStartMinutes / 60) * 60)
const scheduleEndTime = minutesToTime(Math.ceil(maxEndMinutes / 60) * 60)
</script>

<template>
  <p>{{ events.flatMap(event => event.name) }}</p>

  <p>{{ tasks.flatMap(task => task.plannedDate)[2] }}</p>
  <p>{{ startMinutes }}</p>
  <p>{{ endMinutes }}</p>
  <p>{{ miniStartMinutes }}</p>
  <p>{{ maxEndMinutes }}</p>
  <p>{{ scheduleStartTime }}</p>
  <p>{{ scheduleEndTime }}</p>
</template>
