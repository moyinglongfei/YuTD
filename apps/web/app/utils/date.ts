import { calendarDayNumber, calendarWeekday } from '#shared/time'

export { calendarWeekday, clockParts, addCalendarDays, calendarDayNumber, parseZonedDateTime, normalizeTimeZone, inferTimeZone } from '#shared/time'

type Phase = ApiData<Api['api']['phase']['get']>[number]
export const weekdays = [
  '周一',
  '周二',
  '周三',
  '周四',
  '周五',
  '周六',
  '周日'
]

export function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number) as [number, number]
  return hours * 60 + minutes
}

export function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

export function dateToWeekday(date: Date, timeZone = 'UTC') {
  return calendarWeekday(calendarDate(date, timeZone))
}

export function calendarDate(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date)

  const get = (type: 'year' | 'month' | 'day') =>
    parts.find(part => part.type === type)?.value ?? ''

  return `${get('year')}-${get('month')}-${get('day')}`
}

export function getWeekNumber(
  date: Date | null | undefined,
  phase: Phase | null | undefined,
  timeZone: string
): number | null {
  if (!date || !phase) return null

  const currentDate = calendarDate(date, timeZone)
  const startDate = phase.startDate.toISOString().slice(0, 10)
  const endDate = phase.endDate.toISOString().slice(0, 10)

  if (currentDate < startDate || currentDate > endDate)
    return null

  const days = calendarDayNumber(currentDate)
    - calendarDayNumber(startDate)

  return Math.floor(days / 7) + 1
}
