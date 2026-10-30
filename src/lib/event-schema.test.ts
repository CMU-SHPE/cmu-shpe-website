import { describe, expect, it } from 'vitest'
import { MAX_TIME_SLOTS, eventFieldErrors, parseEventForm } from './event-schema'
import { EVENT_TYPES, eventTypeColor, typeColors } from './event-types'

function eventForm(overrides: Record<string, string> = {}) {
  const formData = new FormData()
  const values: Record<string, string> = {
    title: 'Spring Networking Night',
    description: 'Connect with local industry professionals.',
    location: 'CMU Student Union, Room 214',
    type: 'Networking',
    date: '2026-04-15',
    time: '6:00 PM – 9:00 PM',
    ...overrides,
  }
  for (const [name, value] of Object.entries(values)) formData.set(name, value)
  return formData
}

describe('parseEventForm', () => {
  it('parses a valid event', () => {
    expect(parseEventForm(eventForm()).data).toEqual({
      title: 'Spring Networking Night',
      description: 'Connect with local industry professionals.',
      location: 'CMU Student Union, Room 214',
      type: 'Networking',
      date: '2026-04-15',
      endDate: null,
      time: '6:00 PM – 9:00 PM',
      capacity: null,
      slots: [],
    })
  })

  it('treats a blank time as none', () => {
    expect(parseEventForm(eventForm({ time: '  ' })).data?.time).toBeNull()
  })

  it('treats a blank or missing capacity as unlimited', () => {
    expect(parseEventForm(eventForm({ capacity: '' })).data?.capacity).toBeNull()
    expect(parseEventForm(eventForm({ capacity: '  ' })).data?.capacity).toBeNull()
  })

  it('accepts a whole-number capacity from 1 to 10000', () => {
    expect(parseEventForm(eventForm({ capacity: '1' })).data?.capacity).toBe(1)
    expect(parseEventForm(eventForm({ capacity: ' 40 ' })).data?.capacity).toBe(40)
    expect(parseEventForm(eventForm({ capacity: '10000' })).data?.capacity).toBe(10000)
  })

  it('rejects a capacity that is not a positive whole number up to 10000', () => {
    for (const capacity of ['0', '-3', '2.5', '10001', 'ten', '1e3x', 'Infinity']) {
      expect(parseEventForm(eventForm({ capacity })).success, capacity).toBe(false)
    }
  })

  it('rejects a type outside the list', () => {
    expect(parseEventForm(eventForm({ type: 'Party' })).success).toBe(false)
  })

  it('rejects malformed and impossible dates', () => {
    for (const date of ['2026-02-30', 'April 15, 2026', '2026-4-15', '']) {
      expect(parseEventForm(eventForm({ date })).success).toBe(false)
    }
  })

  it('requires a title and location', () => {
    expect(parseEventForm(eventForm({ title: '' })).success).toBe(false)
    expect(parseEventForm(eventForm({ location: ' ' })).success).toBe(false)
  })
})

type Slot = [startDate: string, endDate: string, startTime: string, endTime: string]

function hackathonForm(slots: Slot[], overrides: Record<string, string> = {}) {
  const formData = eventForm({ title: 'Hackathon', date: '2026-10-10', endDate: '2026-10-12', ...overrides })
  for (const [startDate, endDate, startTime, endTime] of slots) {
    formData.append('slotStartDate', startDate)
    formData.append('slotEndDate', endDate)
    formData.append('slotStartTime', startTime)
    formData.append('slotEndTime', endTime)
  }
  return formData
}

function errorsOf(formData: FormData) {
  const parsed = parseEventForm(formData)
  expect(parsed.success).toBe(false)
  return parsed.error ? eventFieldErrors(parsed.error) : {}
}

describe('parseEventForm date ranges and time slots', () => {
  const approved: Slot[] = [
    ['2026-10-12', '2026-10-12', '19:00', '20:00'],
    ['2026-10-10', '2026-10-11', '18:00', '20:00'],
  ]

  it('parses the approved Hackathon example, sorts its slots, and drops the free-text time', () => {
    const parsed = parseEventForm(hackathonForm(approved))
    expect(parsed.data).toMatchObject({
      date: '2026-10-10',
      endDate: '2026-10-12',
      time: null,
      slots: [
        { startDate: '2026-10-10', endDate: '2026-10-11', startTime: '18:00', endTime: '20:00' },
        { startDate: '2026-10-12', endDate: '2026-10-12', startTime: '19:00', endTime: '20:00' },
      ],
    })
  })

  it('keeps the free-text time when there are no slots', () => {
    expect(parseEventForm(hackathonForm([])).data?.time).toBe('6:00 PM – 9:00 PM')
  })

  it('treats a blank end date, or one equal to the start, as a one-day event', () => {
    expect(parseEventForm(eventForm({ endDate: '' })).data?.endDate).toBeNull()
    expect(parseEventForm(eventForm({ endDate: '2026-04-15' })).data?.endDate).toBeNull()
  })

  it('accepts time input values with seconds and stores minutes', () => {
    const parsed = parseEventForm(hackathonForm([['2026-10-10', '2026-10-10', '18:00:00', '20:30:00']]))
    expect(parsed.data?.slots[0]).toMatchObject({ startTime: '18:00', endTime: '20:30' })
  })

  it('refuses an end date before the start date', () => {
    expect(errorsOf(hackathonForm([], { endDate: '2026-10-09' }))).toEqual({
      endDate: 'The end date must be on or after the start date.',
    })
  })

  it('refuses a slot outside the event’s days', () => {
    const errors = errorsOf(
      hackathonForm([
        ['2026-10-09', '2026-10-10', '18:00', '20:00'],
        ['2026-10-12', '2026-10-13', '18:00', '20:00'],
      ]),
    )
    expect(errors).toEqual({
      'slots.0.startDate': 'Pick a day from October 10, 2026 to October 12, 2026.',
      'slots.1.endDate': 'Pick a day from October 10, 2026 to October 12, 2026.',
    })
  })

  it('checks slots of a one-day event against its only day', () => {
    const errors = errorsOf(hackathonForm([['2026-10-11', '2026-10-11', '18:00', '20:00']], { endDate: '' }))
    expect(errors['slots.0.startDate']).toBe('Pick a day from October 10, 2026 to October 10, 2026.')
  })

  it('refuses a slot that ends before it starts, by day or by time', () => {
    const errors = errorsOf(
      hackathonForm([
        ['2026-10-11', '2026-10-10', '18:00', '20:00'],
        ['2026-10-12', '2026-10-12', '20:00', '20:00'],
      ]),
    )
    expect(errors).toEqual({
      'slots.0.endDate': 'The last day must be on or after the first day.',
      'slots.1.endTime': 'The end time must be after the start time.',
    })
  })

  it('refuses slots that overlap on a shared day, but allows back-to-back ones', () => {
    expect(
      errorsOf(
        hackathonForm([
          ['2026-10-10', '2026-10-11', '18:00', '20:00'],
          ['2026-10-11', '2026-10-11', '19:30', '21:00'],
        ]),
      ),
    ).toEqual({ 'slots.1.startTime': 'This overlaps time slot 1 on the same day.' })

    const backToBack = hackathonForm([
      ['2026-10-10', '2026-10-11', '18:00', '20:00'],
      ['2026-10-11', '2026-10-11', '20:00', '21:00'],
      ['2026-10-12', '2026-10-12', '18:30', '19:30'],
    ])
    expect(parseEventForm(backToBack).success).toBe(true)
  })

  it('names the missing parts of an incomplete slot without cross-checking it', () => {
    expect(errorsOf(hackathonForm([['2026-10-10', '', '18:00', '']]))).toEqual({
      'slots.0.endDate': 'Choose the last day of this time slot.',
      'slots.0.endTime': 'Choose an end time.',
    })
  })

  it(`allows ${MAX_TIME_SLOTS} slots and refuses more`, () => {
    const slots = (count: number): Slot[] =>
      Array.from({ length: count }, (_, hour) => [
        '2026-10-10',
        '2026-10-10',
        `${String(hour + 1).padStart(2, '0')}:00`,
        `${String(hour + 1).padStart(2, '0')}:30`,
      ])
    expect(parseEventForm(hackathonForm(slots(MAX_TIME_SLOTS))).success).toBe(true)
    expect(errorsOf(hackathonForm(slots(MAX_TIME_SLOTS + 1)))).toEqual({
      slots: `An event can have at most ${MAX_TIME_SLOTS} time slots.`,
    })
  })

  it('words field errors for officers rather than with zod’s defaults', () => {
    expect(errorsOf(eventForm({ title: '', date: '2026-02-30', capacity: '0' }))).toEqual({
      title: 'Enter a title of up to 200 characters.',
      date: 'Choose the date the event starts.',
      capacity: 'Use a whole number from 1 to 10,000, or leave it blank for no limit.',
    })
  })
})

describe('event types', () => {
  it('has a badge color for every type', () => {
    expect(Object.keys(typeColors).sort()).toEqual([...EVENT_TYPES].sort())
  })

  it('returns no color for an unknown or prototype-like type', () => {
    expect(eventTypeColor('Workshop')).toBe('bg-green-100 text-green-800')
    expect(eventTypeColor('Party')).toBe('')
    expect(eventTypeColor('constructor')).toBe('')
  })
})
