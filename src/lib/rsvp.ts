import { and, asc, count, eq, gte, inArray, sql } from 'drizzle-orm'
import { getDb } from '@/db'
import { eventRsvps, events, members } from '@/db/schema'
import { todayInDenver } from '@/lib/event-dates'
import { getEventTimeSlots } from '@/lib/queries'

export type RsvpOutcome = 'going' | 'full' | 'closed' | 'missing'
export type RsvpState = 'going' | 'open' | 'full'

const lastDay = sql<string>`coalesce(${events.endDate}, ${events.date})`

type Standing = { exists: boolean; upcoming: boolean; going: boolean; full: boolean; confirmed: boolean }

/**
 * Missing outranks past, past outranks an existing RSVP (a past event is no longer actionable), and an
 * unconfirmed or missing member is reported as `missing` because there is nothing they can RSVP as.
 */
function classify(standing: Standing | undefined): RsvpOutcome {
  if (!standing?.exists || !standing.confirmed) return 'missing'
  if (!standing.upcoming) return 'closed'
  if (standing.going) return 'going'
  return 'full'
}

/**
 * One db.batch, so one transaction: locking the event row first makes concurrent RSVPs for the same
 * event queue behind each other, and the insert (a later statement, so a fresh READ COMMITTED snapshot)
 * then counts every RSVP committed before it. A single statement would count on its starting snapshot
 * and could oversell. The last statement reads the outcome inside the same transaction.
 */
export async function rsvp(memberId: number, eventId: number, now = new Date()): Promise<RsvpOutcome> {
  const today = todayInDenver(now)
  const db = getDb()
  const [, inserted, standing] = await db.batch([
    db.select({ id: events.id }).from(events).where(eq(events.id, eventId)).for('update'),
    db.execute<{ id: number }>(sql`
      insert into event_rsvps (event_id, member_id)
      select e.id, m.id
      from events e
      join members m on m.id = ${memberId} and m.email_confirmed_at is not null
      where e.id = ${eventId}
        and coalesce(e.end_date, e.date) >= ${today}::date
        and (e.capacity is null or (select count(*) from event_rsvps r where r.event_id = e.id) < e.capacity)
      on conflict (event_id, member_id) do nothing
      returning id`),
    db.execute<Standing>(sql`
      select
        exists (select 1 from events where id = ${eventId}) as "exists",
        exists (
          select 1 from events where id = ${eventId} and coalesce(end_date, date) >= ${today}::date
        ) as "upcoming",
        exists (select 1 from event_rsvps where event_id = ${eventId} and member_id = ${memberId}) as "going",
        exists (
          select 1 from events e
          where e.id = ${eventId}
            and e.capacity is not null
            and (select count(*) from event_rsvps r where r.event_id = e.id) >= e.capacity
        ) as "full",
        exists (select 1 from members where id = ${memberId} and email_confirmed_at is not null) as "confirmed"`),
  ])
  if (inserted.rows.length > 0) return 'going'
  return classify(standing.rows[0])
}

/** Only upcoming events, so cancelling never rewrites who attended a past one. */
export async function cancelRsvp(memberId: number, eventId: number, now = new Date()): Promise<boolean> {
  const today = todayInDenver(now)
  const deleted = await getDb()
    .delete(eventRsvps)
    .where(
      and(
        eq(eventRsvps.memberId, memberId),
        eq(eventRsvps.eventId, eventId),
        inArray(
          eventRsvps.eventId,
          getDb()
            .select({ id: events.id })
            .from(events)
            .where(and(eq(events.id, eventId), gte(lastDay, today))),
        ),
      ),
    )
    .returning({ id: eventRsvps.id })
  return deleted.length > 0
}

export async function getRsvpStates(memberId: number, eventIds: number[]): Promise<Map<number, RsvpState>> {
  if (eventIds.length === 0) return new Map()
  const rows = await getDb()
    .select({
      id: events.id,
      capacity: events.capacity,
      taken: count(eventRsvps.id),
      going: sql<boolean>`coalesce(bool_or(${eventRsvps.memberId} = ${memberId}), false)`,
    })
    .from(events)
    .leftJoin(eventRsvps, eq(eventRsvps.eventId, events.id))
    .where(inArray(events.id, eventIds))
    .groupBy(events.id)
  return new Map(
    rows.map((row): [number, RsvpState] => [
      row.id,
      row.going ? 'going' : row.capacity !== null && row.taken >= row.capacity ? 'full' : 'open',
    ]),
  )
}

export async function listMyRsvps(memberId: number, now = new Date()) {
  const rows = await getDb()
    .select({
      eventId: events.id,
      title: events.title,
      date: events.date,
      endDate: events.endDate,
      time: events.time,
      location: events.location,
    })
    .from(eventRsvps)
    .innerJoin(events, eq(events.id, eventRsvps.eventId))
    .where(and(eq(eventRsvps.memberId, memberId), gte(lastDay, todayInDenver(now))))
    .orderBy(asc(events.date), asc(events.id))
  const slots = await getEventTimeSlots(rows.map((row) => row.eventId))
  return rows.map((row) => ({ ...row, slots: slots.get(row.eventId) ?? [] }))
}

export async function rsvpCounts(eventIds?: number[]): Promise<Map<number, number>> {
  if (eventIds?.length === 0) return new Map()
  const rows = await getDb()
    .select({ eventId: eventRsvps.eventId, total: count() })
    .from(eventRsvps)
    .where(eventIds ? inArray(eventRsvps.eventId, eventIds) : undefined)
    .groupBy(eventRsvps.eventId)
  return new Map(rows.map((row) => [row.eventId, row.total]))
}

export async function findEvent(eventId: number) {
  const [event] = await getDb()
    .select({
      id: events.id,
      title: events.title,
      date: events.date,
      endDate: events.endDate,
      time: events.time,
      capacity: events.capacity,
    })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1)
  if (!event) return null
  const slots = await getEventTimeSlots([event.id])
  return { ...event, slots: slots.get(event.id) ?? [] }
}

export async function listAttendees(eventId: number) {
  return getDb()
    .select({ name: members.name, email: members.email, rsvpAt: eventRsvps.createdAt })
    .from(eventRsvps)
    .innerJoin(members, eq(members.id, eventRsvps.memberId))
    .where(eq(eventRsvps.eventId, eventId))
    .orderBy(asc(eventRsvps.createdAt), asc(eventRsvps.id))
}
