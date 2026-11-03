export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const denverParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Denver',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const denverTimestampParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Denver',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZoneName: 'short',
})

const longDate = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

function dateParts(value: string): [number, number, number] {
  const [year, month, day] = value.split('-').map(Number)
  return [year, month, day]
}

export function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false
  const [year, month, day] = dateParts(value)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

export function todayInDenver(now: Date): string {
  const parts = Object.fromEntries(denverParts.formatToParts(now).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

/** Sortable in a spreadsheet; the MST/MDT suffix tells apart the hour repeated when daylight saving ends. */
export function formatDenverTimestamp(instant: Date): string {
  const parts = Object.fromEntries(denverTimestampParts.formatToParts(instant).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} ${parts.timeZoneName}`
}

export function formatEventDate(date: string): string {
  const [year, month, day] = dateParts(date)
  return longDate.format(new Date(Date.UTC(year, month - 1, day)))
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = dateParts(date)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

export function lastEventDay(event: { date: string; endDate?: string | null }): string {
  return event.endDate ?? event.date
}

export function splitEvents<T extends { id: number; date: string; endDate?: string | null }>(
  events: readonly T[],
  today: string,
) {
  const upcoming = events
    .filter((event) => lastEventDay(event) >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
  const past = events
    .filter((event) => lastEventDay(event) < today)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
  return { upcoming, past }
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const EN_DASH = '–'

// Built by hand rather than with Intl.formatRange, whose spacing characters differ between ICU versions.
function shortRange(start: string, end: string, withYear: boolean): string {
  const [startYear, startMonth, startDay] = dateParts(start)
  const [endYear, endMonth, endDay] = dateParts(end)
  const startMonthName = SHORT_MONTHS[startMonth - 1]
  const endMonthName = SHORT_MONTHS[endMonth - 1]
  const year = (value: number) => (withYear ? `, ${value}` : '')

  if (start === end) return `${startMonthName} ${startDay}${year(startYear)}`
  if (startYear !== endYear) {
    return `${startMonthName} ${startDay}, ${startYear} ${EN_DASH} ${endMonthName} ${endDay}, ${endYear}`
  }
  if (startMonth !== endMonth) {
    return `${startMonthName} ${startDay} ${EN_DASH} ${endMonthName} ${endDay}${year(endYear)}`
  }
  return `${startMonthName} ${startDay}${EN_DASH}${endDay}${year(endYear)}`
}

export function formatEventDateRange(start: string, end?: string | null): string {
  if (!end || end === start) return formatEventDate(start)
  return shortRange(start, end, true)
}

export function formatClockTime(value: string): string {
  const [hours, minutes] = value.split(':').map(Number)
  const period = hours < 12 ? 'AM' : 'PM'
  const hour = hours % 12 === 0 ? 12 : hours % 12
  return minutes === 0 ? `${hour} ${period}` : `${hour}:${String(minutes).padStart(2, '0')} ${period}`
}

type SlotTimes = { startDate: string; endDate: string; startTime: string; endTime: string }

export function formatTimeSlot(slot: SlotTimes, { withDates = true } = {}): string {
  const times = `${formatClockTime(slot.startTime)} ${EN_DASH} ${formatClockTime(slot.endTime)}`
  return withDates ? `${shortRange(slot.startDate, slot.endDate, false)} · ${times}` : times
}

export type EventSchedule = { dates: string; times: string[] }

/** One-day events with slots leave the date off each slot line, since the date line already says it. */
export function eventSchedule(event: {
  date: string
  endDate?: string | null
  time?: string | null
  slots?: readonly SlotTimes[]
}): EventSchedule {
  const dates = formatEventDateRange(event.date, event.endDate)
  const slots = event.slots ?? []
  if (slots.length === 0) return { dates, times: event.time ? [event.time] : [] }
  const withDates = lastEventDay(event) !== event.date
  return { dates, times: slots.map((slot) => formatTimeSlot(slot, { withDates })) }
}
