import { lastEventDay, splitEvents, weekdayName } from './event-dates'

type SeriesEvent = { id: number; date: string; endDate?: string | null; seriesId?: string | null }

export type SeriesPosition = { position: number; total: number }

function byDate(a: SeriesEvent, b: SeriesEvent) {
  return a.date.localeCompare(b.date) || a.id - b.id
}

/**
 * The weeks a "this and later events" edit or delete reaches besides the chosen one. Weeks that have
 * already ended are left out, and a chosen week that has ended reaches none, so a series change never
 * rewrites the past. Mirrors seriesTargets in event-writes.ts, which applies the same rule inside the write.
 */
export function laterInSeries<T extends SeriesEvent>(events: readonly T[], chosen: SeriesEvent, today: string): T[] {
  if (!chosen.seriesId || lastEventDay(chosen) < today) return []
  return events
    .filter(
      (event) =>
        event.seriesId === chosen.seriesId && byDate(event, chosen) > 0 && lastEventDay(event) >= today,
    )
    .sort(byDate)
}

export function seriesPositions(events: readonly SeriesEvent[]): Map<number, SeriesPosition> {
  const series = new Map<string, SeriesEvent[]>()
  for (const event of events) {
    if (event.seriesId) series.set(event.seriesId, [...(series.get(event.seriesId) ?? []), event])
  }
  const positions = new Map<number, SeriesPosition>()
  for (const weeks of series.values()) {
    weeks.sort(byDate).forEach((event, index) => positions.set(event.id, { position: index + 1, total: weeks.length }))
  }
  return positions
}

export function seriesLabel({ position, total }: SeriesPosition): string {
  return `Weekly · ${position} of ${total}`
}

export function repeatLabel(date: string): string {
  return `Every ${weekdayName(date)}`
}

/** Upcoming keeps only the next week of each series; Past lists every week that has ended. */
export function publicEventListings<T extends SeriesEvent>(events: readonly T[], today: string) {
  const { upcoming, past } = splitEvents(events, today)
  const shown = new Set<string>()
  const next = upcoming.filter((event) => {
    if (!event.seriesId) return true
    if (shown.has(event.seriesId)) return false
    shown.add(event.seriesId)
    return true
  })
  return { upcoming: next, past }
}
