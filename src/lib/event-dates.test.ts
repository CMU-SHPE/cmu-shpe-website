import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { csvField } from './csv'
import { formatDenverTimestamp, formatEventDate, isRealDate, splitEvents, todayInDenver } from './event-dates'

describe('todayInDenver', () => {
  it('returns the Denver calendar date, not the UTC one, on a UTC evening', () => {
    expect(todayInDenver(new Date('2026-04-16T03:30:00Z'))).toBe('2026-04-15')
  })

  it('rolls over at Denver midnight', () => {
    expect(todayInDenver(new Date('2026-04-16T05:59:00Z'))).toBe('2026-04-15')
    expect(todayInDenver(new Date('2026-04-16T06:00:00Z'))).toBe('2026-04-16')
  })

  it('accounts for mountain standard time in winter', () => {
    expect(todayInDenver(new Date('2026-01-01T06:30:00Z'))).toBe('2025-12-31')
    expect(todayInDenver(new Date('2026-01-01T07:00:00Z'))).toBe('2026-01-01')
  })
})

describe('formatEventDate', () => {
  const originalTz = process.env.TZ

  beforeAll(() => {
    process.env.TZ = 'America/Denver'
  })

  afterAll(() => {
    process.env.TZ = originalTz
  })

  it('formats a stored date as a long US date', () => {
    expect(formatEventDate('2026-04-15')).toBe('April 15, 2026')
  })

  it('does not shift the day in a timezone west of UTC', () => {
    expect(formatEventDate('2026-01-01')).toBe('January 1, 2026')
    expect(formatEventDate('2026-12-31')).toBe('December 31, 2026')
  })
})

describe('isRealDate', () => {
  it('accepts real calendar dates, including leap days', () => {
    expect(isRealDate('2026-04-15')).toBe(true)
    expect(isRealDate('2028-02-29')).toBe(true)
  })

  it('rejects impossible dates and other formats', () => {
    for (const value of ['2026-02-30', '2027-02-29', '2026-13-01', '2026-00-10', '2026-4-15', '04/15/2026', '']) {
      expect(isRealDate(value)).toBe(false)
    }
  })
})

describe('splitEvents', () => {
  const events = [
    { id: 1, date: '2026-03-08' },
    { id: 2, date: '2026-05-03' },
    { id: 3, date: '2026-04-15' },
    { id: 4, date: '2026-02-20' },
    { id: 5, date: '2026-04-22' },
  ]

  it('puts today and later in upcoming, soonest first', () => {
    expect(splitEvents(events, '2026-04-15').upcoming.map((event) => event.id)).toEqual([3, 5, 2])
  })

  it('puts earlier dates in past, most recent first', () => {
    expect(splitEvents(events, '2026-04-15').past.map((event) => event.id)).toEqual([1, 4])
  })

  it('handles no events', () => {
    expect(splitEvents([], '2026-04-15')).toEqual({ upcoming: [], past: [] })
  })
})

describe('formatDenverTimestamp', () => {
  it.each([
    ['2026-01-15T07:00:00Z', '2026-01-15 00:00 MST'],
    ['2026-07-04T23:45:00Z', '2026-07-04 17:45 MDT'],
    ['2027-01-01T06:59:00Z', '2026-12-31 23:59 MST'],
  ])('formats %s in Mountain time as %s', (instant, expected) => {
    expect(formatDenverTimestamp(new Date(instant))).toBe(expected)
  })

  it('tells the repeated hour apart when daylight saving ends', () => {
    expect(formatDenverTimestamp(new Date('2026-11-01T07:30:00Z'))).toBe('2026-11-01 01:30 MDT')
    expect(formatDenverTimestamp(new Date('2026-11-01T08:30:00Z'))).toBe('2026-11-01 01:30 MST')
  })

  it('passes through CSV escaping unchanged', () => {
    const value = formatDenverTimestamp(new Date('2026-10-01T12:00:00Z'))
    expect(csvField(value)).toBe(value)
  })
})
