import type { ClubEvent, EventTimeSlot } from '@/db/schema'
import { addDays, formatEventDate, isRealDate, weekdayName, weeklyOccurrenceCount } from '@/lib/event-dates'
import { type EventFieldErrors, type SlotFormValues, slotsFromForm } from '@/lib/event-schema'

const TEXT_FIELDS = ['title', 'description', 'location', 'type', 'date', 'endDate', 'time', 'capacity'] as const

type TextField = (typeof TEXT_FIELDS)[number]

/** `scope` is "later" when an edit or delete also reaches the later events in the series. */
export type SeriesFormValues = { repeatsWeekly?: string; repeatUntil?: string; scope?: string }

export type EventFormValues = Record<TextField, string> & SeriesFormValues & { slots: SlotFormValues[] }

export type EventFormState = { errors?: EventFieldErrors; values?: EventFormValues }

export function eventFormValues(formData: FormData): EventFormValues {
  const text = (name: TextField | keyof SeriesFormValues) => {
    const value = formData.get(name)
    return typeof value === 'string' ? value : ''
  }
  return {
    ...(Object.fromEntries(TEXT_FIELDS.map((name) => [name, text(name)])) as Record<TextField, string>),
    repeatsWeekly: text('repeatsWeekly'),
    repeatUntil: text('repeatUntil'),
    scope: text('scope'),
    slots: slotsFromForm(formData),
  }
}

export function appliesToLaterEvents(formData?: FormData) {
  return formData?.get('scope') === 'later'
}

// Capacity is at least 1, so a capacity below the count always means two or more RSVPs.
export function capacityBelowRsvpsMessage(going: number) {
  return `This event already has ${going} RSVPs, so the capacity can't be lower than ${going}.`
}

export function seriesCapacityBelowRsvpsMessage(date: string, going: number) {
  return `The ${formatEventDate(date)} event already has ${going} RSVPs, so the capacity can't be lower than ${going}.`
}

const rsvpCount = (going: number) => `${going} ${going === 1 ? 'RSVP' : 'RSVPs'}`

export function eventDeleteWarning(going: number) {
  if (going === 0) return 'It has no RSVPs to remove.'
  return `This also removes its ${rsvpCount(going)}.`
}

export function seriesDeleteWarning(later: number, going: number) {
  const events = `This deletes this event and the ${later} later ${later === 1 ? 'event' : 'events'} in the series.`
  return going === 0 ? `${events} They have no RSVPs to remove.` : `${events} This also removes their ${rsvpCount(going)}.`
}

/** Null until both dates are real and at least a week apart, the same as the server accepts. */
export function seriesCreateSummary(start: string, until: string) {
  if (!isRealDate(start) || !isRealDate(until)) return null
  const count = weeklyOccurrenceCount(start, until)
  if (count < 2) return null
  const last = addDays(start, (count - 1) * 7)
  return `This creates ${count} events, every ${weekdayName(start)} from ${formatEventDate(start)} to ${formatEventDate(last)}.`
}

// Postgres returns `time` as HH:MM:SS, but a native time input only shows HH:MM without a step.
export function storedEventFormValues(event: ClubEvent & { slots: EventTimeSlot[] }): EventFormValues {
  return {
    title: event.title,
    description: event.description,
    location: event.location,
    type: event.type,
    date: event.date,
    endDate: event.endDate ?? '',
    time: event.time ?? '',
    capacity: event.capacity === null ? '' : String(event.capacity),
    slots: event.slots.map((slot) => ({
      startDate: slot.startDate,
      endDate: slot.endDate,
      startTime: slot.startTime.slice(0, 5),
      endTime: slot.endTime.slice(0, 5),
    })),
  }
}
