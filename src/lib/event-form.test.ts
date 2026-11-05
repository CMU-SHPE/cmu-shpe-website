import { describe, expect, it } from 'vitest'
import {
  appliesToLaterEvents,
  capacityBelowRsvpsMessage,
  eventDeleteWarning,
  seriesCapacityBelowRsvpsMessage,
  seriesCreateSummary,
  seriesDeleteWarning,
} from './event-form'

describe('eventDeleteWarning', () => {
  it.each([
    [0, 'It has no RSVPs to remove.'],
    [1, 'This also removes its 1 RSVP.'],
    [12, 'This also removes its 12 RSVPs.'],
  ])('words %i RSVPs correctly', (going, warning) => {
    expect(eventDeleteWarning(going)).toBe(warning)
  })
})

describe('capacityBelowRsvpsMessage', () => {
  it('names the current RSVP count', () => {
    expect(capacityBelowRsvpsMessage(12)).toBe("This event already has 12 RSVPs, so the capacity can't be lower than 12.")
  })
})

describe('seriesDeleteWarning', () => {
  it.each([
    [1, 0, 'This deletes this event and the 1 later event in the series. They have no RSVPs to remove.'],
    [9, 1, 'This deletes this event and the 9 later events in the series. This also removes their 1 RSVP.'],
    [9, 34, 'This deletes this event and the 9 later events in the series. This also removes their 34 RSVPs.'],
  ])('words %i later events with %i RSVPs', (later, going, warning) => {
    expect(seriesDeleteWarning(later, going)).toBe(warning)
  })
})

describe('seriesCapacityBelowRsvpsMessage', () => {
  it('names the week and its RSVP count', () => {
    expect(seriesCapacityBelowRsvpsMessage('2026-11-12', 12)).toBe(
      "The November 12, 2026 event already has 12 RSVPs, so the capacity can't be lower than 12.",
    )
  })
})

describe('seriesCreateSummary', () => {
  it('counts the events and names the weekday and the last week', () => {
    expect(seriesCreateSummary('2026-01-15', '2026-04-25')).toBe(
      'This creates 15 events, every Thursday from January 15, 2026 to April 23, 2026.',
    )
  })

  it('says nothing until both dates are real and a week apart', () => {
    expect(seriesCreateSummary('', '2026-04-25')).toBeNull()
    expect(seriesCreateSummary('2026-01-15', '')).toBeNull()
    expect(seriesCreateSummary('2026-01-15', '2026-01-21')).toBeNull()
  })
})

describe('appliesToLaterEvents', () => {
  it('is true only when the later events option was chosen', () => {
    const form = new FormData()
    expect(appliesToLaterEvents(undefined)).toBe(false)
    expect(appliesToLaterEvents(form)).toBe(false)
    form.set('scope', 'event')
    expect(appliesToLaterEvents(form)).toBe(false)
    form.set('scope', 'later')
    expect(appliesToLaterEvents(form)).toBe(true)
  })
})
