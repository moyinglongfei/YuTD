import { taskDateRange } from '#shared/time'

type DateValue = Date | string | null
interface TipTask {
  id: number
  title: string
  phaseId: number
  plannedDate: DateValue
  dueDate: DateValue
  completed: boolean
  status: string
}
interface DailyTip {
  id: number
  content: string
  dates: { date: Date | string, phaseId: number | null }[]
  weeks: { date: Date | string, phaseId: number | null }[]
  events: { id: number, name: string, phaseId: number }[]
  tasks: { id: number }[]
}
interface Occurrence {
  eventId: number
  phaseId: number
  time: Date | string
  endTime: Date | string
}

export function dailyTipDateKey(value: Date | string): string {
  // Eden 会将纯日期解析成 UTC 零点的 Date；还原原始日期，不按用户时区偏移。
  return value instanceof Date ? value.toISOString().slice(0, 10) : value
}

export function visibleDailyTips<T extends DailyTip>(tips: readonly T[], tasks: readonly TipTask[], occurrences: readonly Occurrence[], day: string, now: Date, timeZone: string, phaseId?: number) {
  const timestamp = now.getTime()
  const range = taskDateRange(day, timeZone, false)
  const week = taskDateRange(day, timeZone, true).startDate
  const matches = (value: { date: Date | string, phaseId: number | null }, date: string) => dailyTipDateKey(value.date) === date
    && (phaseId === undefined || value.phaseId === null || value.phaseId === phaseId)
  const rank = (value: { time: number | null, ongoing: boolean }) => value.time === null ? 3 : value.ongoing ? 0 : value.time >= timestamp ? 1 : 2
  const compare = (a: { time: number | null, ongoing: boolean }, b: { time: number | null, ongoing: boolean }) => rank(a) - rank(b)
    || (rank(a) === 2 ? b.time! - a.time! : (a.time ?? 0) - (b.time ?? 0))
  return tips.flatMap((tip) => {
    const times: { time: number, ongoing: boolean, source: string }[] = []
    for (const event of tip.events) {
      for (const occurrence of occurrences) {
        if (occurrence.eventId !== event.id || (phaseId !== undefined && occurrence.phaseId !== phaseId)) continue
        const start = new Date(occurrence.time).getTime()
        const end = new Date(occurrence.endTime).getTime()
        if (end > timestamp) times.push({ time: start, ongoing: start <= timestamp, source: event.name })
      }
    }
    for (const task of tasks) {
      if (!tip.tasks.some(value => value.id === task.id) || (phaseId !== undefined && task.phaseId !== phaseId)
        || task.completed || task.status === 'DONE' || task.status === 'CANCELLED') continue
      for (const value of [task.plannedDate, task.dueDate]) {
        const time = value ? new Date(value).getTime() : NaN
        if (time >= range.start.getTime() && time < range.end.getTime())
          times.push({ time, ongoing: false, source: task.title })
      }
    }
    const allDay = tip.dates.some(value => matches(value, day)) || tip.weeks.some(value => matches(value, week))
    times.sort(compare)
    const nearest = times[0]
    if (!nearest && !allDay) return []
    return [{
      ...tip, time: nearest?.time ?? null, ongoing: nearest?.ongoing ?? false,
      overdue: Boolean(nearest && !nearest.ongoing && nearest.time < timestamp),
      sources: [...new Set(times.map(value => value.source))]
    }]
  }).sort((a, b) => compare(a, b) || a.id - b.id)
}
