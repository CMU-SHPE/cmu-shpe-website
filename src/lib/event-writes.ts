import { eq, sql } from 'drizzle-orm'
import { type Db, getDb } from '@/db'
import { eventTimeSlots, events } from '@/db/schema'
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

export type EventUpdateOutcome = { status: 'saved' } | { status: 'missing' } | { status: 'over-capacity'; going: number }

/**
 * One db.batch, the same shape as rsvp() and for the same reason: taking the event's row lock first queues
 * this behind concurrent RSVPs, and the later write statement then counts every RSVP committed before it.
 * The write is one statement because cancelling an RSVP takes no lock, so separate statements could each
 * see a different count and replace the slots of an event whose update was refused.
 */
export async function updateEventWithSlots(
  eventId: number,
  { slots, title, description, location, type, date, endDate, time, capacity }: EventInput,
): Promise<EventUpdateOutcome> {
  const db = getDb()
  const fitsCapacity =
    capacity === null ? sql`true` : sql`(select count(*) from event_rsvps where event_id = ${eventId}) <= ${capacity}`
  const slotRows = JSON.stringify(slots.map((slot, sortOrder) => ({ ...slot, sortOrder })))
  const [, written, standing] = await db.batch([
    db.select({ id: events.id }).from(events).where(eq(events.id, eventId)).for('update'),
    db.execute<{ id: number }>(sql`
      with updated as (
        update events
        set title = ${title}, description = ${description}, location = ${location}, type = ${type},
            date = ${date}, end_date = ${endDate}, time = ${time}, capacity = ${capacity}
        where id = ${eventId} and ${fitsCapacity}
        returning id
      ), cleared as (
        delete from event_time_slots where event_id in (select id from updated)
      ), added as (
        insert into event_time_slots (event_id, start_date, end_date, start_time, end_time, sort_order)
        select updated.id, slot."startDate", slot."endDate", slot."startTime", slot."endTime", slot."sortOrder"
        from updated
        cross join jsonb_to_recordset(${slotRows}::jsonb)
          as slot("startDate" date, "endDate" date, "startTime" time, "endTime" time, "sortOrder" int)
      )
      select id from updated`),
    db.execute<{ exists: boolean; going: number }>(sql`
      select
        exists (select 1 from events where id = ${eventId}) as "exists",
        (select count(*)::int from event_rsvps where event_id = ${eventId}) as "going"`),
  ])
  if (written.rows.length > 0) return { status: 'saved' }
  const { exists, going } = standing.rows[0]
  return exists ? { status: 'over-capacity', going } : { status: 'missing' }
}
