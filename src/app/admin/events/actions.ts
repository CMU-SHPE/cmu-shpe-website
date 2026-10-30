'use server'

import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { events } from '@/db/schema'
import { requireAdmin } from '@/lib/admin'
import { type EventFormState, eventFormValues } from '@/lib/event-form'
import { eventFieldErrors, parseEventForm } from '@/lib/event-schema'
import { createEventWithSlots, updateEventWithSlots } from '@/lib/event-writes'
import { recordId } from '@/lib/form-fields'

function refused(formData: FormData, errors: EventFormState['errors']): EventFormState {
  return { errors, values: eventFormValues(formData) }
}

// Used with useActionState, so the previous state comes before the form.
export async function createEvent(_previous: EventFormState, formData: FormData): Promise<EventFormState> {
  await requireAdmin()

  const parsed = parseEventForm(formData)
  if (!parsed.success) return refused(formData, eventFieldErrors(parsed.error))

  await createEventWithSlots(parsed.data)
  redirect('/admin/events?saved=1')
}

export async function updateEvent(id: number, _previous: EventFormState, formData: FormData): Promise<EventFormState> {
  await requireAdmin()

  const eventId = recordId.safeParse(id)
  if (!eventId.success) redirect('/admin/events?error=invalid')
  const parsed = parseEventForm(formData)
  if (!parsed.success) return refused(formData, eventFieldErrors(parsed.error))

  if (!(await updateEventWithSlots(eventId.data, parsed.data))) redirect('/admin/events?error=missing')
  redirect('/admin/events?saved=1')
}

export async function deleteEvent(id: number) {
  await requireAdmin()

  const eventId = recordId.safeParse(id)
  if (!eventId.success) redirect('/admin/events?error=invalid')

  await getDb().delete(events).where(eq(events.id, eventId.data))
  redirect('/admin/events?saved=1')
}
