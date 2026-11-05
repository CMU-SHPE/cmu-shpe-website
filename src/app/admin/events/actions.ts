'use server'

import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { todayInDenver } from '@/lib/event-dates'
import {
  appliesToLaterEvents,
  capacityBelowRsvpsMessage,
  type EventFormState,
  eventFormValues,
  seriesCapacityBelowRsvpsMessage,
  seriesMoveClashMessage,
} from '@/lib/event-form'
import {
  type EventFieldErrors,
  type EventInput,
  endsTooLateForSeries,
  eventFieldErrors,
  parseEventForm,
  parseWeeklyRepeat,
  SERIES_SPAN_MESSAGE,
} from '@/lib/event-schema'
import { seriesMoveClash } from '@/lib/event-series'
import { createEventSeries, createEventWithSlots, deleteEvents, updateEventWithSlots } from '@/lib/event-writes'
import { recordId } from '@/lib/form-fields'
import { getSeriesWeeks } from '@/lib/queries'

function refused(formData: FormData, errors: EventFormState['errors']): EventFormState {
  return { errors, values: eventFormValues(formData) }
}

function seriesScope(formData?: FormData) {
  return { later: appliesToLaterEvents(formData), today: todayInDenver(new Date()) }
}

/** Every week of a series keeps to its own week, whichever weeks an edit reaches. */
async function seriesEditErrors(
  eventId: number,
  input: EventInput,
  scope: ReturnType<typeof seriesScope>,
): Promise<EventFieldErrors> {
  const weeks = await getSeriesWeeks(eventId)
  const chosen = weeks.find((week) => week.id === eventId)
  if (!chosen?.seriesId) return {}
  if (endsTooLateForSeries(input.date, input.endDate)) return { endDate: SERIES_SPAN_MESSAGE }
  const clash = scope.later ? seriesMoveClash(weeks, chosen, input, scope.today) : null
  return clash ? { date: seriesMoveClashMessage(clash.moved.date, clash.movedTo, clash.onto.date) } : {}
}

// Used with useActionState, so the previous state comes before the form.
export async function createEvent(_previous: EventFormState, formData: FormData): Promise<EventFormState> {
  await requireAdmin()

  const parsed = parseEventForm(formData)
  const repeat = parseWeeklyRepeat(formData, {
    date: String(formData.get('date') ?? '').trim(),
    endDate: String(formData.get('endDate') ?? '').trim() || null,
  })
  if (!parsed.success) return refused(formData, { ...repeat.errors, ...eventFieldErrors(parsed.error) })
  if (Object.keys(repeat.errors).length > 0) return refused(formData, repeat.errors)

  if (repeat.dates) await createEventSeries(parsed.data, repeat.dates)
  else await createEventWithSlots(parsed.data)
  redirect('/admin/events?saved=1')
}

export async function updateEvent(id: number, _previous: EventFormState, formData: FormData): Promise<EventFormState> {
  await requireAdmin()

  const eventId = recordId.safeParse(id)
  if (!eventId.success) redirect('/admin/events?error=invalid')
  const parsed = parseEventForm(formData)
  if (!parsed.success) return refused(formData, eventFieldErrors(parsed.error))

  const scope = seriesScope(formData)
  const seriesErrors = await seriesEditErrors(eventId.data, parsed.data, scope)
  if (Object.keys(seriesErrors).length > 0) return refused(formData, seriesErrors)
  const outcome = await updateEventWithSlots(eventId.data, parsed.data, scope)
  if (outcome.status === 'missing') redirect('/admin/events?error=missing')
  if (outcome.status === 'over-capacity') {
    return refused(formData, {
      capacity: scope.later
        ? seriesCapacityBelowRsvpsMessage(outcome.date, outcome.going)
        : capacityBelowRsvpsMessage(outcome.going),
    })
  }
  redirect('/admin/events?saved=1')
}

export async function deleteEvent(id: number, formData?: FormData) {
  await requireAdmin()

  const eventId = recordId.safeParse(id)
  if (!eventId.success) redirect('/admin/events?error=invalid')

  await deleteEvents(eventId.data, seriesScope(formData))
  redirect('/admin/events?saved=1')
}
