import { Temporal } from '@js-temporal/polyfill'

const regionTimeZones: Record<string, string> = {
  CN: 'Asia/Shanghai', HK: 'Asia/Hong_Kong', MO: 'Asia/Macau', TW: 'Asia/Taipei',
  SG: 'Asia/Singapore', JP: 'Asia/Tokyo', KR: 'Asia/Seoul', IN: 'Asia/Kolkata',
  GB: 'Europe/London', US: 'America/New_York', CA: 'America/Toronto',
  AU: 'Australia/Sydney', NZ: 'Pacific/Auckland', DE: 'Europe/Berlin',
  FR: 'Europe/Paris', ES: 'Europe/Madrid', IT: 'Europe/Rome', PT: 'Europe/Lisbon',
  RU: 'Europe/Moscow', BR: 'America/Sao_Paulo', MX: 'America/Mexico_City',
  TH: 'Asia/Bangkok', VN: 'Asia/Ho_Chi_Minh', ID: 'Asia/Jakarta',
  PH: 'Asia/Manila', MY: 'Asia/Kuala_Lumpur', AE: 'Asia/Dubai',
  SA: 'Asia/Riyadh', ZA: 'Africa/Johannesburg'
}

export function normalizeTimeZone(value: string) {
  return new Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions().timeZone
}

export function inferTimeZone(locale: string) {
  try {
    const region = new Intl.Locale(locale).maximize().region
    return regionTimeZones[region ?? ''] ?? 'UTC'
  } catch {
    return 'UTC'
  }
}

function zoned(value: Date | string | number, timeZone: string) {
  return Temporal.Instant.from(new Date(value).toISOString()).toZonedDateTimeISO(timeZone)
}

export function calendarDate(value: Date | string | number, timeZone: string) {
  return zoned(value, timeZone).toPlainDate().toString()
}

export function clockParts(value: Date | string | number, timeZone: string) {
  const date = zoned(value, timeZone)
  return { hour: date.hour, minute: date.minute, second: date.second }
}

export function addCalendarDays(date: string, days: number) {
  return Temporal.PlainDate.from(date).add({ days }).toString()
}

export function calendarDayNumber(date: string) {
  return Temporal.PlainDate.from(date).since('1970-01-01', { largestUnit: 'days' }).days
}

export function calendarWeekday(date: string) {
  return Temporal.PlainDate.from(date).dayOfWeek
}

export function parseZonedDateTime(value: string, timeZone: string, disambiguation: 'reject' | 'compatible' = 'reject') {
  let milliseconds: number
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const day = Temporal.PlainDate.from(value)
    const start = day.toZonedDateTime(timeZone)
    if (!start.toPlainDate().equals(day))
      throw new RangeError('该日期在所选时区不存在')
    milliseconds = start.epochMilliseconds
  } else if (/(?:z|[+-]\d{2}:?\d{2})$/i.test(value)) {
    milliseconds = Temporal.Instant.from(value).epochMilliseconds
  } else {
    milliseconds = Temporal.PlainDateTime.from(value).toZonedDateTime(timeZone, { disambiguation }).epochMilliseconds
  }
  return new Date(milliseconds)
}

export function taskDateRange(date: string, timeZone: string, weekly: boolean) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new RangeError('日期必须为 YYYY-MM-DD')
  const day = Temporal.PlainDate.from(date)
  const first = weekly ? day.subtract({ days: day.dayOfWeek - 1 }) : day
  const next = first.add({ days: weekly ? 7 : 1 })
  const start = first.toZonedDateTime(timeZone)
  if (!weekly && !start.toPlainDate().equals(first))
    throw new RangeError('该日期在所选时区不存在')
  return {
    startDate: first.toString(),
    endDate: next.subtract({ days: 1 }).toString(),
    start: new Date(start.epochMilliseconds),
    end: new Date(next.toZonedDateTime(timeZone).epochMilliseconds)
  }
}
