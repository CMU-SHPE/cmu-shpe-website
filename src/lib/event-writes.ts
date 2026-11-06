import { randomUUID } from 'crypto'
import { type SQL, sql } from 'drizzle-orm'
import { getDb } from '@/db'
import { eventTimeSlots, events } from '@/db/schema'
import { addDays, daysBetween } from '@/lib/event-dates'
import type { EventInput } from '@/lib/event-schema'

// neon-http has no interactive transactions, so the ids are drawn first and the events and their slots
// are written together in one batch.
async function createEvents({ slots, ...fields }: EventInput, dates: string[], seriesId: string | null) {
  const db = getDb()
  const { rows } = await db.execute<{ id: number }>(
    sql`select nextval(pg_get_serial_sequence('events', 'id'))::int as id from generate_series(1, ${dates.length})`,
  )
  const ids = rows.map((row) => row.id)
  const shifts = dates.map((date) => daysBetween(fields.date, date))
  const shift = (date: string, index: number) => addDays(date, shifts[index])
  const eventRows = ids.map((id, index) => ({
    ...fields,
    id,
    seriesId,
    date: dates[index],
    endDate: fields.endDate && shift(fields.endDate, index),
  }))
  const slotRows = ids.flatMap((eventId, index) =>
    slots.map((slot, sortOrder) => ({
      ...slot,
      startDate: shift(slot.startDate, index),
      endDate: shift(slot.endDate, index),
      eventId,
      sortOrder,
    })),
  )
  await db.batch([
    db.insert(events).values(eventRows),
    ...(slotRows.length === 0 ? [] : [db.insert(eventTimeSlots).values(slotRows)]),
  ])
  return ids
}

export async function createEventWithSlots(input: EventInput): Promise<number> {
  const [id] = await createEvents(input, [input.date], null)
  return id
}

/** One event per date, each a copy of `input` moved to that week, all linked by a new series id. */
export async function createEventSeries(input: EventInput, dates: string[]): Promise<number[]> {
  return createEvents(input, dates, randomUUID())
}

export type SeriesScope = { later: boolean; today: string }

export const THIS_EVENT_ONLY: SeriesScope = { later: false, today: '' }

/**
 * The chosen event, plus with `later` every event after it in its series that hasn't ended by `today`,
 * each with its distance in days from the chosen one. A chosen event that has ended reaches no other
 * week. Mirrors laterInSeries in event-series.ts.
 */
function seriesTargets(eventId: number, { later, today }: SeriesScope): SQL {
  if (!later) return sql`select id, 0 as shift from events where id = ${eventId}`
  return sql`
    select e.id, e.date - chosen.date as shift
    from events chosen
    join events e on e.id = chosen.id or (
      e.series_id = chosen.series_id
      and coalesce(chosen.end_date, chosen.date) >= ${today}::date
      and (e.date, e.id) > (chosen.date, chosen.id)
      and coalesce(e.end_date, e.date) >= ${today}::date
    )
    where chosen.id = ${eventId}`
}

function lockTargets(targets: SQL) {
  return sql`select id from events where id in (select id from (${targets}) as targets) order by id for update`
}

export type EventUpdateOutcome =
  | { status: 'saved' }
  | { status: 'missing' }
  | { status: 'over-capacity'; going: number; date: string }

/**
 * One db.batch, the same shape as rsvp() and for the same reason: taking the events' row locks first (in id
 * order, so two series edits can't deadlock) queues this behind concurrent RSVPs, and the later write
 * statement then counts every RSVP committed before it. The write is one statement because cancelling an
 * RSVP takes no lock, so separate statements could each see a different count and replace the slots of an
 * event whose update was refused. Every week moves by the same number of days as the chosen one, so a
 * series keeps its spacing; when any week has more RSVPs than the new capacity none is written, and the
 * week with the most RSVPs is reported because its count is the lowest capacity that fits them all.
 */
export async function updateEventWithSlots(
  eventId: number,
  { slots, title, description, location, type, date, endDate, time, capacity }: EventInput,
  scope: SeriesScope = THIS_EVENT_ONLY,
): Promise<EventUpdateOutcome> {
  const db = getDb()
  const targets = seriesTargets(eventId, scope)
  const fitsCapacity =
    capacity === null
      ? sql`true`
      : sql`not exists (
          select 1 from targets where (select count(*) from event_rsvps where event_id = targets.id) > ${capacity}
        )`
  const slotRows = JSON.stringify(slots.map((slot, sortOrder) => ({ ...slot, sortOrder })))
  const [, written, standing] = await db.batch([
    db.execute(lockTargets(targets)),
    db.execute<{ id: number }>(sql`
      with targets as (${targets}), updated as (
        update events
        set title = ${title}, description = ${description}, location = ${location}, type = ${type},
            date = ${date}::date + targets.shift, end_date = ${endDate}::date + targets.shift, time = ${time},
            capacity = ${capacity}
        from targets
        where events.id = targets.id and ${fitsCapacity}
        returning events.id, targets.shift
      ), cleared as (
        delete from event_time_slots where event_id in (select id from updated)
      ), added as (
        insert into event_time_slots (event_id, start_date, end_date, start_time, end_time, sort_order)
        select updated.id, slot."startDate" + updated.shift, slot."endDate" + updated.shift, slot."startTime",
               slot."endTime", slot."sortOrder"
        from updated
        cross join jsonb_to_recordset(${slotRows}::jsonb)
          as slot("startDate" date, "endDate" date, "startTime" time, "endTime" time, "sortOrder" int)
      )
      select id from updated`),
    db.execute<{ date: string; going: number }>(sql`
      with targets as (${targets})
      select events.date::text as "date",
             (select count(*)::int from event_rsvps where event_id = events.id) as "going"
      from targets join events on events.id = targets.id
      order by "going" desc, events.date
      limit 1`),
  ])
  if (written.rows.length > 0) return { status: 'saved' }
  const busiest = standing.rows[0]
  return busiest ? { status: 'over-capacity', going: busiest.going, date: busiest.date } : { status: 'missing' }
}

/**
 * Returns how many events were deleted; their slots and RSVPs go with them. The rows are locked first
 * in id order, the same order as updateEventWithSlots, so a series delete and a series edit can't deadlock.
 */
export async function deleteEvents(eventId: number, scope: SeriesScope = THIS_EVENT_ONLY): Promise<number> {
  const db = getDb()
  const targets = seriesTargets(eventId, scope)
  const [, deleted] = await db.batch([
    db.execute(lockTargets(targets)),
    db.execute<{ id: number }>(
      sql`delete from events where id in (select id from (${targets}) as targets) returning id`,
    ),
  ])
  return deleted.rows.length
}
