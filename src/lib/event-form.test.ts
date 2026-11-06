import { describe, expect, it } from 'vitest'
import {
  appliesToLaterEvents,
  capacityBelowRsvpsMessage,
  eventDeleteWarning,
  seriesCapacityBelowRsvpsMessage,
  seriesCreateSummary,
  seriesDeleteWarning,
  seriesMoveClashMessage,
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

  it('gives the server limit message past 52 events instead of a count', () => {
    expect(seriesCreateSummary('2026-01-01', '2026-12-24')).toMatch(/^This creates 52 events/)
    expect(seriesCreateSummary('2026-01-01', '2027-02-25')).toBe(
      'A weekly event can repeat at most 52 times. Choose a date on or before December 24, 2026.',
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

describe('seriesMoveClashMessage', () => {
  it('names the moved week, where it would go and the week it would land on', () => {
    expect(seriesMoveClashMessage('2026-11-12', '2026-11-05', '2026-11-05')).toBe(
      'This moves the November 12, 2026 event to November 5, 2026, on, across or past the November 5, 2026 event in the same series, which this change leaves where it is. Choose another start date.',
    )
  })
})
