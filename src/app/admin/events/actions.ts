'use server'

import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { events } from '@/db/schema'
import { requireAdmin } from '@/lib/admin'
import { parseEventForm } from '@/lib/event-schema'
import { recordId } from '@/lib/form-fields'

export async function createEvent(formData: FormData) {
  await requireAdmin()

  const parsed = parseEventForm(formData)
  if (!parsed.success) redirect('/admin/events?error=invalid')

  await getDb().insert(events).values(parsed.data)
  redirect('/admin/events?saved=1')
}

export async function updateEvent(id: number, formData: FormData) {
  await requireAdmin()

  const eventId = recordId.safeParse(id)
  const parsed = parseEventForm(formData)
  if (!eventId.success || !parsed.success) redirect('/admin/events?error=invalid')

  const updated = await getDb()
    .update(events)
    .set(parsed.data)
    .where(eq(events.id, eventId.data))
    .returning({ id: events.id })
  if (updated.length === 0) redirect('/admin/events?error=missing')

  redirect('/admin/events?saved=1')
}

export async function deleteEvent(id: number) {
  await requireAdmin()

  const eventId = recordId.safeParse(id)
  if (!eventId.success) redirect('/admin/events?error=invalid')

  await getDb().delete(events).where(eq(events.id, eventId.data))
  redirect('/admin/events?saved=1')
}
