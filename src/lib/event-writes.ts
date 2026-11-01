import { eq, sql } from 'drizzle-orm'
import { type Db, getDb } from '@/db'
import { eventTimeSlots, events } from '@/db/schema'
import { isForeignKeyViolation } from '@/lib/db-errors'
import type { EventInput } from '@/lib/event-schema'

function insertSlots(db: Db, eventId: number, slots: EventInput['slots']) {
  return slots.length === 0
    ? []
    : [db.insert(eventTimeSlots).values(slots.map((slot, sortOrder) => ({ ...slot, eventId, sortOrder })))]
}

// neon-http has no interactive transactions, so the id is drawn first and the event and its slots
// are written together in one batch.
export async function createEventWithSlots({ slots, ...fields }: EventInput): Promise<number> {
  const db = getDb()
  const { rows } = await db.execute<{ id: number }>(
    sql`select nextval(pg_get_serial_sequence('events', 'id'))::int as id`,
  )
  const id = rows[0].id
  await db.batch([db.insert(events).values({ ...fields, id }), ...insertSlots(db, id, slots)])
  return id
}

/** Replaces every slot. Returns false when the event no longer exists. */
export async function updateEventWithSlots(eventId: number, { slots, ...fields }: EventInput): Promise<boolean> {
  const db = getDb()
  try {
    const [updated] = await db.batch([
      db.update(events).set(fields).where(eq(events.id, eventId)).returning({ id: events.id }),
      db.delete(eventTimeSlots).where(eq(eventTimeSlots.eventId, eventId)),
      ...insertSlots(db, eventId, slots),
    ])
    return updated.length > 0
  } catch (error) {
    if (isForeignKeyViolation(error)) return false
    throw error
  }
}
