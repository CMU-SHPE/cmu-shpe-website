export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const denverParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Denver',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
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

export function formatEventDate(date: string): string {
  const [year, month, day] = dateParts(date)
  return longDate.format(new Date(Date.UTC(year, month - 1, day)))
}

export function splitEvents<T extends { id: number; date: string }>(events: readonly T[], today: string) {
  const upcoming = events
    .filter((event) => event.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
  const past = events
    .filter((event) => event.date < today)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
  return { upcoming, past }
}
