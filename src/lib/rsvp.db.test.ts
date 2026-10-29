import { eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { getDb } from '@/db'
import { eventRsvps, events, members } from '@/db/schema'
import { createEvent, createMember, resetDb } from '@/test/db'
import { cancelRsvp, getRsvpStates, listAttendees, listMyRsvps, rsvp, rsvpCounts } from './rsvp'

const NOW = new Date('2026-10-27T18:00:00Z')
const TODAY = '2026-10-27'
const RACE_CAPACITY = 3
const RACE_MEMBERS = 8
const GATE_TAG = 'rsvp-race-gate'
const GATE_TIMEOUT_SECONDS = 20

beforeEach(resetDb)

async function rsvpRows(eventId: number) {
  return getDb().select().from(eventRsvps).where(eq(eventRsvps.eventId, eventId))
}

async function createMembers(total: number) {
  return Promise.all(Array.from({ length: total }, () => createMember()))
}

describe('rsvp and cancelRsvp', () => {
  it('records an RSVP, is idempotent, and cancels it', async () => {
    const [member, event] = await Promise.all([createMember(), createEvent()])

    expect(await rsvp(member.id, event.id, NOW)).toBe('going')
    expect(await rsvp(member.id, event.id, NOW)).toBe('going')
    expect(await rsvpRows(event.id)).toHaveLength(1)

    expect(await cancelRsvp(member.id, event.id, NOW)).toBe(true)
    expect(await rsvpRows(event.id)).toHaveLength(0)
    expect(await cancelRsvp(member.id, event.id, NOW)).toBe(false)

    expect(await rsvp(member.id, event.id, NOW)).toBe('going')
    expect(await rsvpRows(event.id)).toHaveLength(1)
  })

  it('accepts an event happening today in Denver and refuses one that already happened', async () => {
    const member = await createMember()
    const [today, yesterday] = await Promise.all([createEvent({ date: TODAY }), createEvent({ date: '2026-10-26' })])

    expect(await rsvp(member.id, today.id, NOW)).toBe('going')
    expect(await rsvp(member.id, yesterday.id, NOW)).toBe('closed')
    expect(await rsvpRows(yesterday.id)).toHaveLength(0)
  })

  it('uses the Denver date, not UTC, to decide what is upcoming', async () => {
    const member = await createMember()
    const event = await createEvent({ date: '2026-10-27' })
    // 03:00 UTC on the 28th is still the evening of the 27th in Denver.
    expect(await rsvp(member.id, event.id, new Date('2026-10-28T03:00:00Z'))).toBe('going')
  })

  it('keeps a multi-day event open through its last day in Denver and closes it the day after', async () => {
    const member = await createMember()
    const event = await createEvent({ date: '2026-10-26', endDate: '2026-10-28' })

    expect(await rsvp(member.id, event.id, NOW)).toBe('going')
    expect(await cancelRsvp(member.id, event.id, new Date('2026-10-29T05:59:00Z'))).toBe(true)
    // Late on the 28th in Denver is already the 29th in UTC.
    expect(await rsvp(member.id, event.id, new Date('2026-10-29T05:59:00Z'))).toBe('going')
    expect((await listMyRsvps(member.id, new Date('2026-10-29T05:59:00Z'))).map((row) => row.eventId)).toEqual([event.id])

    const other = await createMember()
    const dayAfter = new Date('2026-10-29T06:00:00Z')
    expect(await rsvp(other.id, event.id, dayAfter)).toBe('closed')
    expect(await cancelRsvp(member.id, event.id, dayAfter)).toBe(false)
    expect(await listMyRsvps(member.id, dayAfter)).toEqual([])
    expect((await rsvpRows(event.id)).map((row) => row.memberId)).toEqual([member.id])
  })

  it('reports a missing event', async () => {
    const member = await createMember()
    expect(await rsvp(member.id, 999, NOW)).toBe('missing')
  })

  it('refuses an unconfirmed or missing member', async () => {
    const [unconfirmed, event] = await Promise.all([createMember({ confirmed: false }), createEvent()])
    expect(await rsvp(unconfirmed.id, event.id, NOW)).toBe('missing')
    expect(await rsvp(999, event.id, NOW)).toBe('missing')
    expect(await rsvpRows(event.id)).toHaveLength(0)
  })

  it('reports a full event, and still reports going for a member already on the list', async () => {
    const [first, second, event] = await Promise.all([createMember(), createMember(), createEvent({ capacity: 1 })])
    expect(await rsvp(first.id, event.id, NOW)).toBe('going')
    expect(await rsvp(second.id, event.id, NOW)).toBe('full')
    expect(await rsvp(first.id, event.id, NOW)).toBe('going')
  })

  it('reports closed rather than going for a past event the member attended', async () => {
    const [member, event] = await Promise.all([createMember(), createEvent({ date: '2026-10-01' })])
    await getDb().insert(eventRsvps).values({ eventId: event.id, memberId: member.id })
    expect(await rsvp(member.id, event.id, NOW)).toBe('closed')
  })

  it('never cancels an RSVP to a past event', async () => {
    const [member, event] = await Promise.all([createMember(), createEvent({ date: '2026-10-01' })])
    await getDb().insert(eventRsvps).values({ eventId: event.id, memberId: member.id })

    expect(await cancelRsvp(member.id, event.id, NOW)).toBe(false)
    expect(await rsvpRows(event.id)).toHaveLength(1)
  })

  it('only cancels the given member and event', async () => {
    const [member, other, event, otherEvent] = await Promise.all([
      createMember(),
      createMember(),
      createEvent(),
      createEvent(),
    ])
    await rsvp(member.id, event.id, NOW)
    await rsvp(other.id, event.id, NOW)
    await rsvp(member.id, otherEvent.id, NOW)

    await cancelRsvp(member.id, event.id, NOW)
    const remaining = await getDb().select().from(eventRsvps)
    expect(remaining.map(({ eventId, memberId }) => ({ eventId, memberId }))).toEqual(
      expect.arrayContaining([
        { eventId: event.id, memberId: other.id },
        { eventId: otherEvent.id, memberId: member.id },
      ]),
    )
    expect(remaining).toHaveLength(2)
  })

  it('removes RSVPs when the member or the event is deleted', async () => {
    const [member, other, event, otherEvent] = await Promise.all([
      createMember(),
      createMember(),
      createEvent(),
      createEvent(),
    ])
    await rsvp(member.id, event.id, NOW)
    await rsvp(other.id, otherEvent.id, NOW)

    await getDb().delete(members).where(eq(members.id, member.id))
    expect(await rsvpRows(event.id)).toHaveLength(0)

    await getDb().delete(events).where(eq(events.id, otherEvent.id))
    expect(await getDb().select().from(eventRsvps)).toHaveLength(0)
  })
})

/**
 * Makes every racer start its statement while the event row is still locked, so they all queue on the
 * lock and the outcome no longer depends on how the requests happen to interleave. A gate transaction
 * locks the row and waits inside Postgres until `racers.length` backends are blocked on it, then
 * commits and lets them through.
 */
async function raceBehindLockedEvent<T>(eventId: number, racers: (() => Promise<T>)[]): Promise<T[]> {
  const db = getDb()
  const gate = db.batch([
    db.select({ id: events.id }).from(events).where(eq(events.id, eventId)).for('update'),
    db.execute(
      sql.raw(`/* ${GATE_TAG} */ do $$
        declare deadline timestamptz := clock_timestamp() + interval '${GATE_TIMEOUT_SECONDS} seconds';
        begin
          while (select count(*) from pg_locks where not granted) < ${racers.length} loop
            if clock_timestamp() > deadline then raise exception 'racers never queued behind the gate'; end if;
            perform pg_sleep(0.01);
          end loop;
        end $$`),
    ),
  ])
  await waitForGateToHoldLock()
  const results = Promise.all(racers.map((race) => race()))
  await gate
  return results
}

async function waitForGateToHoldLock() {
  const deadline = Date.now() + GATE_TIMEOUT_SECONDS * 1000
  while (Date.now() < deadline) {
    const { rows } = await getDb().execute<{ holding: boolean }>(sql`
      select exists (
        select 1 from pg_stat_activity
        where pid <> pg_backend_pid() and state = 'active' and query like ${`/* ${GATE_TAG} */%`}
      ) as holding`)
    if (rows[0]?.holding) return
  }
  throw new Error('the gate transaction never took the event lock')
}

describe('the capacity race', () => {
  it(`seats exactly capacity when ${RACE_MEMBERS} members RSVP while the event is locked`, async () => {
    const [event, racers] = await Promise.all([createEvent({ capacity: RACE_CAPACITY }), createMembers(RACE_MEMBERS)])

    const outcomes = await raceBehindLockedEvent(
      event.id,
      racers.map((member) => () => rsvp(member.id, event.id, NOW)),
    )

    expect(await rsvpRows(event.id)).toHaveLength(RACE_CAPACITY)
    expect(outcomes.filter((outcome) => outcome === 'going')).toHaveLength(RACE_CAPACITY)
    expect(outcomes.filter((outcome) => outcome === 'full')).toHaveLength(RACE_MEMBERS - RACE_CAPACITY)
  }, 60_000)

  it('keeps one row when the same member RSVPs many times at once', async () => {
    const [member, event] = await Promise.all([createMember(), createEvent({ capacity: 1 })])

    const outcomes = await raceBehindLockedEvent(
      event.id,
      Array.from({ length: RACE_MEMBERS }, () => () => rsvp(member.id, event.id, NOW)),
    )

    expect(await rsvpRows(event.id)).toEqual([expect.objectContaining({ memberId: member.id })])
    expect(outcomes).toEqual(Array(RACE_MEMBERS).fill('going'))
  }, 60_000)

  // Negative control: the single-statement shape the batch replaces counts on the snapshot it took before
  // waiting for the lock, so behind the same gate every racer gets in. Without this the tests above
  // would also pass with no protection at all.
  it('lets every racer in through a single statement that locks and counts on one snapshot', async () => {
    const [event, racers] = await Promise.all([createEvent({ capacity: RACE_CAPACITY }), createMembers(RACE_MEMBERS)])

    await raceBehindLockedEvent(
      event.id,
      racers.map((member) => () => brokenRsvp(member.id, event.id)),
    )

    expect(await rsvpRows(event.id)).toHaveLength(RACE_MEMBERS)
  }, 60_000)
})

async function brokenRsvp(memberId: number, eventId: number) {
  await getDb().execute(sql`
    with locked as (select id from events where id = ${eventId} for update)
    insert into event_rsvps (event_id, member_id)
    select e.id, ${memberId}::int
    from events e
    join locked on locked.id = e.id
    where e.date >= ${TODAY}::date
      and (e.capacity is null or (select count(*) from event_rsvps r where r.event_id = e.id) < e.capacity)
    on conflict (event_id, member_id) do nothing`)
}

describe('RSVP reads', () => {
  it('reports going, open and full per event, and nothing for an empty list', async () => {
    const [member, other, unlimited, roomy, full, mine] = await Promise.all([
      createMember(),
      createMember(),
      createEvent(),
      createEvent({ capacity: 2 }),
      createEvent({ capacity: 1 }),
      createEvent({ capacity: 1 }),
    ])
    await rsvp(other.id, roomy.id, NOW)
    await rsvp(other.id, full.id, NOW)
    await rsvp(member.id, mine.id, NOW)

    const states = await getRsvpStates(member.id, [unlimited.id, roomy.id, full.id, mine.id])
    expect(Object.fromEntries(states)).toEqual({
      [unlimited.id]: 'open',
      [roomy.id]: 'open',
      [full.id]: 'full',
      [mine.id]: 'going',
    })
    expect((await getRsvpStates(member.id, [])).size).toBe(0)
  })

  it('lists only the member’s upcoming RSVPs, soonest first', async () => {
    const [member, other] = await Promise.all([createMember(), createMember()])
    const [later, sooner, past, notMine] = await Promise.all([
      createEvent({ date: '2099-02-01', title: 'Later', time: '6 PM' }),
      createEvent({ date: '2099-01-01', title: 'Sooner' }),
      createEvent({ date: '2026-10-01', title: 'Past' }),
      createEvent({ title: 'Not mine' }),
    ])
    await rsvp(member.id, later.id, NOW)
    await rsvp(member.id, sooner.id, NOW)
    await getDb().insert(eventRsvps).values({ eventId: past.id, memberId: member.id })
    await rsvp(other.id, notMine.id, NOW)

    expect(await listMyRsvps(member.id, NOW)).toEqual([
      { eventId: sooner.id, title: 'Sooner', date: '2099-01-01', time: null, location: sooner.location },
      { eventId: later.id, title: 'Later', date: '2099-02-01', time: '6 PM', location: later.location },
    ])
  })

  it('counts RSVPs per event and lists attendees in RSVP order', async () => {
    const [first, second, event, otherEvent, empty] = await Promise.all([
      createMember({ name: 'Ana' }),
      createMember({ name: 'Ben' }),
      createEvent(),
      createEvent(),
      createEvent(),
    ])
    await rsvp(first.id, event.id, NOW)
    await rsvp(second.id, event.id, NOW)
    await rsvp(second.id, otherEvent.id, NOW)

    expect(Object.fromEntries(await rsvpCounts())).toEqual({ [event.id]: 2, [otherEvent.id]: 1 })
    expect(Object.fromEntries(await rsvpCounts([otherEvent.id, empty.id]))).toEqual({ [otherEvent.id]: 1 })
    expect((await rsvpCounts([])).size).toBe(0)

    const attendees = await listAttendees(event.id)
    expect(attendees.map(({ name, email }) => ({ name, email }))).toEqual([
      { name: 'Ana', email: first.email },
      { name: 'Ben', email: second.email },
    ])
    expect(attendees[0].rsvpAt).toBeInstanceOf(Date)
    expect(await listAttendees(empty.id)).toEqual([])
  })
})
