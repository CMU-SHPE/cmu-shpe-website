import { describe, expect, it } from 'vitest'
import { capacityBelowRsvpsMessage, eventDeleteWarning } from './event-form'

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
