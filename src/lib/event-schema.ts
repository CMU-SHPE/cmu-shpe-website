import { z } from 'zod'
import { formatEventDate, isRealDate } from './event-dates'
import { EVENT_TYPES } from './event-types'
import { optional, optionalText, requiredText } from './form-fields'

export const MAX_EVENT_DESCRIPTION_LENGTH = 2000
export const MAX_EVENT_CAPACITY = 10000
export const MAX_TIME_SLOTS = 14

// zod's own wording ("Too big: expected string to have <=200 characters") isn't written for officers.
const FIELD_MESSAGES: Record<string, string> = {
  title: 'Enter a title of up to 200 characters.',
  description: `Keep the description to ${MAX_EVENT_DESCRIPTION_LENGTH.toLocaleString('en-US')} characters.`,
  location: 'Enter a location of up to 200 characters.',
  type: 'Choose a type from the list.',
  date: 'Choose the date the event starts.',
  endDate: 'Choose a real end date, or leave it blank for a one-day event.',
  time: 'Keep the time to 100 characters.',
  capacity: 'Use a whole number from 1 to 10,000, or leave it blank for no limit.',
}

const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

const realDate = (message: string) => z.string().trim().refine(isRealDate, message)
const clockTime = (message: string) =>
  z
    .string()
    .trim()
    .regex(CLOCK_TIME, message)
    .transform((value) => value.slice(0, 5))

const timeSlotSchema = z.object({
  startDate: realDate('Choose the first day of this time slot.'),
  endDate: realDate('Choose the last day of this time slot.'),
  startTime: clockTime('Choose a start time.'),
  endTime: clockTime('Choose an end time.'),
})

export type TimeSlotInput = z.infer<typeof timeSlotSchema>

// zod still runs the cross-field checks when a field failed its own check, so they skip incomplete slots.
function isCompleteSlot(slot: TimeSlotInput) {
  return (
    isRealDate(slot.startDate) && isRealDate(slot.endDate) && CLOCK_TIME.test(slot.startTime) && CLOCK_TIME.test(slot.endTime)
  )
}

function sharesADay(a: TimeSlotInput, b: TimeSlotInput) {
  return a.startDate <= b.endDate && b.startDate <= a.endDate
}

const minutes = (time: string) => time.slice(0, 5)

function sharesATime(a: TimeSlotInput, b: TimeSlotInput) {
  return minutes(a.startTime) < minutes(b.endTime) && minutes(b.startTime) < minutes(a.endTime)
}

export const eventSchema = z
  .object({
    title: requiredText(200),
    description: z.string().trim().max(MAX_EVENT_DESCRIPTION_LENGTH),
    location: requiredText(200),
    type: z.enum(EVENT_TYPES),
    date: realDate(FIELD_MESSAGES.date),
    endDate: optional(realDate(FIELD_MESSAGES.endDate)),
    time: optionalText(100),
    capacity: optional(z.coerce.number().int().positive().max(MAX_EVENT_CAPACITY)),
    slots: z.array(timeSlotSchema),
  })
  .superRefine((event, context) => {
    if (!isRealDate(event.date) || (event.endDate && !isRealDate(event.endDate))) return
    const lastDay = event.endDate ?? event.date
    if (lastDay < event.date) {
      context.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'The end date must be on or after the start date.',
      })
      return
    }
    if (event.slots.length > MAX_TIME_SLOTS) {
      context.addIssue({
        code: 'custom',
        path: ['slots'],
        message: `An event can have at most ${MAX_TIME_SLOTS} time slots.`,
      })
      return
    }

    const withinEvent = `Pick a day from ${formatEventDate(event.date)} to ${formatEventDate(lastDay)}.`
    event.slots.forEach((slot, index) => {
      if (!isCompleteSlot(slot)) return
      const issue = (field: keyof TimeSlotInput, message: string) =>
        context.addIssue({ code: 'custom', path: ['slots', index, field], message })

      if (slot.startDate < event.date || slot.startDate > lastDay) issue('startDate', withinEvent)
      if (slot.endDate < slot.startDate) issue('endDate', 'The last day must be on or after the first day.')
      else if (slot.endDate > lastDay) issue('endDate', withinEvent)
      if (minutes(slot.endTime) <= minutes(slot.startTime)) issue('endTime', 'The end time must be after the start time.')

      const clash = event.slots.findIndex(
        (other, otherIndex) =>
          otherIndex < index && isCompleteSlot(other) && sharesADay(slot, other) && sharesATime(slot, other),
      )
      if (clash !== -1) issue('startTime', `This overlaps time slot ${clash + 1} on the same day.`)
    })
  })
  .transform((event) => ({
    ...event,
    endDate: event.endDate === event.date ? null : event.endDate,
    time: event.slots.length > 0 ? null : event.time,
    slots: [...event.slots].sort(
      (a, b) => a.startDate.localeCompare(b.startDate) || a.startTime.localeCompare(b.startTime),
    ),
  }))

export type EventInput = z.output<typeof eventSchema>

export const SLOT_FIELDS = {
  startDate: 'slotStartDate',
  endDate: 'slotEndDate',
  startTime: 'slotStartTime',
  endTime: 'slotEndTime',
} as const satisfies Record<keyof TimeSlotInput, string>

export type SlotFormValues = Record<keyof TimeSlotInput, string>

function textValue(value: FormDataEntryValue | undefined) {
  return typeof value === 'string' ? value : ''
}

export function slotsFromForm(formData: FormData): SlotFormValues[] {
  const columns = {
    startDate: formData.getAll(SLOT_FIELDS.startDate),
    endDate: formData.getAll(SLOT_FIELDS.endDate),
    startTime: formData.getAll(SLOT_FIELDS.startTime),
    endTime: formData.getAll(SLOT_FIELDS.endTime),
  }
  const rows = Math.max(...Object.values(columns).map((column) => column.length))
  return Array.from({ length: rows }, (_, index) => ({
    startDate: textValue(columns.startDate[index]),
    endDate: textValue(columns.endDate[index]),
    startTime: textValue(columns.startTime[index]),
    endTime: textValue(columns.endTime[index]),
  }))
}

export function parseEventForm(formData: FormData) {
  return eventSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
    location: formData.get('location'),
    type: formData.get('type'),
    date: formData.get('date'),
    endDate: formData.get('endDate'),
    time: formData.get('time'),
    capacity: formData.get('capacity'),
    slots: slotsFromForm(formData),
  })
}

export type EventFieldErrors = Record<string, string>

/** Keys are field names, or `slots.<row>.<field>` for a time slot input. */
export function eventFieldErrors(error: z.ZodError): EventFieldErrors {
  const errors: EventFieldErrors = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.')
    if (errors[key]) continue
    errors[key] = issue.code !== 'custom' && FIELD_MESSAGES[key] ? FIELD_MESSAGES[key] : issue.message
  }
  return errors
}
