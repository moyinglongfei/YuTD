import { calendarDate, taskDateRange } from './time.ts'

type DateValue = Date | string | null
interface AttentionTask {
  id: number
  priority: number
  plannedDate: DateValue
  dueDate: DateValue
  completed: boolean
  status: string
  completedAt?: DateValue
}
interface AttentionTip {
  dates: { date: string, phaseId?: number | null }[]
  weeks?: { date: string, phaseId?: number | null }[]
  events: { id: number }[]
  tasks: { id: number }[]
}
export interface TipOccurrence {
  eventId: number
  scheduleId: number
  time: string
}

const time = (value: DateValue | undefined) => value ? new Date(value).getTime() : NaN
const closed = (task: AttentionTask) => task.completed || task.status === 'DONE' || task.status === 'CANCELLED'

// 后端返回全天候选，前后端共用筛选规则，避免上课后仍展示旧提示。
export function dailyTipGroups<T extends AttentionTip>(tips: readonly T[], tasks: readonly AttentionTask[], occurrences: readonly TipOccurrence[], date: Date, timeZone: string, phaseId?: number) {
  const day = calendarDate(date, timeZone)
  const range = taskDateRange(day, timeZone, false)
  const week = taskDateRange(day, timeZone, true).startDate
  const matches = (value: { date: string, phaseId?: number | null }, selected: string) => value.date === selected
    && (phaseId === undefined || value.phaseId == null || value.phaseId === phaseId)
  const timestamp = date.getTime()
  const upcoming = occurrences.filter(value => time(value.time) >= timestamp)
    .sort((a, b) => time(a.time) - time(b.time) || a.scheduleId - b.scheduleId)
  const nextEventId = upcoming[0]?.eventId
  const todayEvents = new Set(upcoming.filter(value => calendarDate(value.time, timeZone) === day).map(value => value.eventId))
  const taskTimes = tasks.filter(task => !closed(task))
    .flatMap(task => [task.plannedDate, task.dueDate]
      .map(time).filter(value => value >= range.start.getTime() && value < range.end.getTime())
      .map(value => ({ id: task.id, priority: task.priority, time: value })))
    .sort((a, b) => {
      const future = a.time >= timestamp
      if (future !== (b.time >= timestamp)) return future ? -1 : 1
      return (future ? a.time - b.time : b.time - a.time) || b.priority - a.priority || a.id - b.id
    })
  const nearestTaskId = taskTimes[0]?.id
  const todayTasks = new Set(taskTimes.map(value => value.id))
  const important: T[] = []
  const normal: T[] = []
  for (const tip of tips) {
    if (tip.dates.some(value => matches(value, day))
      || tip.weeks?.some(value => matches(value, week))
      || tip.events.some(event => event.id === nextEventId)
      || tip.tasks.some(task => task.id === nearestTaskId))
      important.push(tip)
    else if (tip.events.some(event => todayEvents.has(event.id)) || tip.tasks.some(task => todayTasks.has(task.id)))
      normal.push(tip)
  }
  return { important, normal }
}
