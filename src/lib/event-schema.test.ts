import { describe, expect, it } from 'vitest'
import { parseEventForm } from './event-schema'
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
      time: '6:00 PM – 9:00 PM',
    })
  })

  it('treats a blank time as none', () => {
    expect(parseEventForm(eventForm({ time: '  ' })).data?.time).toBeNull()
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
