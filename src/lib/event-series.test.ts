import { describe, expect, it } from 'vitest'
import { laterInSeries, publicEventListings, repeatLabel, seriesLabel, seriesPositions } from './event-series'

const week = (id: number, date: string, seriesId: string | null = 'thursdays') => ({ id, date, endDate: null, seriesId })

const thursdays = [
  week(1, '2026-10-29'),
  week(2, '2026-11-05'),
  week(3, '2026-11-12'),
  week(4, '2026-11-19'),
]

describe('laterInSeries', () => {
  it('returns the later weeks of the same series in date order', () => {
    const other = week(9, '2026-11-26', 'mondays')
    expect(laterInSeries([thursdays[3], other, ...thursdays.slice(0, 3)], thursdays[1], '2026-11-01').map((e) => e.id)).toEqual([3, 4])
  })

  it('leaves out weeks that have already ended', () => {
    expect(laterInSeries(thursdays, thursdays[0], '2026-11-13').map((e) => e.id)).toEqual([4])
  })

  it('keeps a later week that is still running today', () => {
    const running = { ...week(5, '2026-11-11'), endDate: '2026-11-13' }
    expect(laterInSeries([...thursdays, running], thursdays[0], '2026-11-13').map((e) => e.id)).toEqual([5, 4])
  })

  it('is empty for an event outside any series', () => {
    expect(laterInSeries(thursdays, week(7, '2026-10-01', null), '2026-01-01')).toEqual([])
  })
})

describe('seriesPositions and seriesLabel', () => {
  it('numbers each series by date and skips one-off events', () => {
    const positions = seriesPositions([thursdays[2], week(8, '2026-11-01', null), thursdays[0], thursdays[1]])
    expect(positions.get(1)).toEqual({ position: 1, total: 3 })
    expect(positions.get(3)).toEqual({ position: 3, total: 3 })
    expect(positions.has(8)).toBe(false)
    expect(seriesLabel({ position: 3, total: 15 })).toBe('Weekly · 3 of 15')
  })
})

describe('repeatLabel', () => {
  it('names the weekday of the date, not of the UTC day before or after', () => {
    expect(repeatLabel('2026-11-05')).toBe('Every Thursday')
    expect(repeatLabel('2026-03-08')).toBe('Every Sunday')
  })
})

describe('publicEventListings', () => {
  it('shows only the next week of each series in Upcoming and every ended week in Past', () => {
    const mondays = [week(10, '2026-11-09', 'mondays'), week(11, '2026-11-16', 'mondays')]
    const oneOffs = [week(20, '2026-11-10', null), week(21, '2026-11-10', null)]
    const { upcoming, past } = publicEventListings([...thursdays, ...mondays, ...oneOffs], '2026-11-06')

    expect(upcoming.map((event) => event.id)).toEqual([10, 20, 21, 3])
    expect(past.map((event) => event.id)).toEqual([2, 1])
  })

  it('treats events without a series id as one-off events', () => {
    const { upcoming } = publicEventListings([{ id: 1, date: '2099-01-01' }, { id: 2, date: '2099-01-02' }], '2026-01-01')
    expect(upcoming).toHaveLength(2)
  })
})
