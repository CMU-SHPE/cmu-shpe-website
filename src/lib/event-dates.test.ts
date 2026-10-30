import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { csvField } from './csv'
import {
  addDays,
  eventSchedule,
  formatClockTime,
  formatDenverTimestamp,
  formatEventDate,
  formatEventDateRange,
  formatTimeSlot,
  isRealDate,
  splitEvents,
  todayInDenver,
} from './event-dates'

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

describe('splitEvents with multi-day events', () => {
  const events = [
    { id: 1, date: '2026-10-10', endDate: '2026-10-12' },
    { id: 2, date: '2026-10-11', endDate: null },
    { id: 3, date: '2026-10-08', endDate: '2026-10-10' },
  ]

  it('keeps an event upcoming through its last day and sorts by its first day', () => {
    expect(splitEvents(events, '2026-10-11').upcoming.map((event) => event.id)).toEqual([1, 2])
    expect(splitEvents(events, '2026-10-12').upcoming.map((event) => event.id)).toEqual([1])
  })

  it('moves it to past the day after its last day', () => {
    expect(splitEvents(events, '2026-10-11').past.map((event) => event.id)).toEqual([3])
    expect(splitEvents(events, '2026-10-13').past.map((event) => event.id)).toEqual([2, 1, 3])
  })
})

describe('formatEventDateRange', () => {
  it('keeps a one-day event exactly as before', () => {
    expect(formatEventDateRange('2026-04-15')).toBe('April 15, 2026')
    expect(formatEventDateRange('2026-04-15', null)).toBe('April 15, 2026')
    expect(formatEventDateRange('2026-04-15', '2026-04-15')).toBe('April 15, 2026')
  })

  it('shortens a range within one month', () => {
    expect(formatEventDateRange('2026-10-10', '2026-10-12')).toBe('Oct 10–12, 2026')
  })

  it('names both months across months', () => {
    expect(formatEventDateRange('2026-10-30', '2026-11-01')).toBe('Oct 30 – Nov 1, 2026')
  })

  it('gives full dates across years', () => {
    expect(formatEventDateRange('2026-12-30', '2027-01-02')).toBe('Dec 30, 2026 – Jan 2, 2027')
  })
})

describe('formatClockTime', () => {
  it('drops zero minutes and keeps the rest', () => {
    expect(formatClockTime('18:00:00')).toBe('6 PM')
    expect(formatClockTime('18:30')).toBe('6:30 PM')
    expect(formatClockTime('09:05')).toBe('9:05 AM')
  })

  it('handles midnight and noon', () => {
    expect(formatClockTime('00:00')).toBe('12 AM')
    expect(formatClockTime('12:00')).toBe('12 PM')
    expect(formatClockTime('12:45')).toBe('12:45 PM')
  })
})

describe('formatTimeSlot', () => {
  it('formats the approved slot lines', () => {
    expect(formatTimeSlot({ startDate: '2026-10-10', endDate: '2026-10-11', startTime: '18:00:00', endTime: '20:00:00' })).toBe(
      'Oct 10–11 · 6 PM – 8 PM',
    )
    expect(formatTimeSlot({ startDate: '2026-10-12', endDate: '2026-10-12', startTime: '19:00', endTime: '20:00' })).toBe(
      'Oct 12 · 7 PM – 8 PM',
    )
  })

  it('shows minutes only when they are not zero, and spans months', () => {
    expect(formatTimeSlot({ startDate: '2026-10-31', endDate: '2026-11-01', startTime: '18:30', endTime: '20:00' })).toBe(
      'Oct 31 – Nov 1 · 6:30 PM – 8 PM',
    )
  })
})

describe('eventSchedule', () => {
  it('shows a legacy free-text time when there are no slots', () => {
    expect(eventSchedule({ date: '2026-04-15', endDate: null, time: '6:00 PM – 9:00 PM', slots: [] })).toEqual({
      dates: 'April 15, 2026',
      times: ['6:00 PM – 9:00 PM'],
    })
    expect(eventSchedule({ date: '2026-04-15', time: null })).toEqual({ dates: 'April 15, 2026', times: [] })
  })

  it('shows the slots instead of the free-text time for the approved example', () => {
    expect(
      eventSchedule({
        date: '2026-10-10',
        endDate: '2026-10-12',
        time: 'ignored',
        slots: [
          { startDate: '2026-10-10', endDate: '2026-10-11', startTime: '18:00:00', endTime: '20:00:00' },
          { startDate: '2026-10-12', endDate: '2026-10-12', startTime: '19:00:00', endTime: '20:00:00' },
        ],
      }),
    ).toEqual({ dates: 'Oct 10–12, 2026', times: ['Oct 10–11 · 6 PM – 8 PM', 'Oct 12 · 7 PM – 8 PM'] })
  })

  it('leaves the date off slot lines of a one-day event', () => {
    expect(
      eventSchedule({
        date: '2026-10-10',
        slots: [{ startDate: '2026-10-10', endDate: '2026-10-10', startTime: '18:00', endTime: '19:30' }],
      }).times,
    ).toEqual(['6 PM – 7:30 PM'])
  })
})

describe('addDays', () => {
  it('crosses month and year ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})
