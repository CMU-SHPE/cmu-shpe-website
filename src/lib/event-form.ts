import type { ClubEvent, EventTimeSlot } from '@/db/schema'
import { type EventFieldErrors, type SlotFormValues, slotsFromForm } from '@/lib/event-schema'

const TEXT_FIELDS = ['title', 'description', 'location', 'type', 'date', 'endDate', 'time', 'capacity'] as const

type TextField = (typeof TEXT_FIELDS)[number]

export type EventFormValues = Record<TextField, string> & { slots: SlotFormValues[] }

export type EventFormState = { errors?: EventFieldErrors; values?: EventFormValues }

export function eventFormValues(formData: FormData): EventFormValues {
  const text = (name: TextField) => {
    const value = formData.get(name)
    return typeof value === 'string' ? value : ''
  }
  return {
    ...(Object.fromEntries(TEXT_FIELDS.map((name) => [name, text(name)])) as Record<TextField, string>),
    slots: slotsFromForm(formData),
  }
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
