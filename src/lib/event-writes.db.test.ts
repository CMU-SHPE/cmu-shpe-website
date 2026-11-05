import { asc, eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { getDb } from '@/db'
import { eventRsvps, eventTimeSlots, events } from '@/db/schema'
import { createEvent, createMember, raceBehindLockedEvent, resetDb } from '@/test/db'
import type { EventInput } from './event-schema'
import { addDays, todayInDenver } from './event-dates'
import { laterInSeries, publicEventListings } from './event-series'
import { createEventSeries, createEventWithSlots, deleteEvents, updateEventWithSlots } from './event-writes'
import { getEvents } from './queries'
import { rsvp } from './rsvp'

beforeEach(resetDb)

const hackathon: EventInput = {
  title: 'Hackathon',
  description: '',
  location: 'Lab',
  type: 'Workshop',
  date: '2099-10-10',
  endDate: '2099-10-12',
  time: null,
  capacity: null,
  slots: [
    { startDate: '2099-10-10', endDate: '2099-10-11', startTime: '18:00', endTime: '20:00' },
    { startDate: '2099-10-12', endDate: '2099-10-12', startTime: '19:00', endTime: '20:00' },
  ],
}

async function slotsOf(eventId: number) {
  return getDb()
    .select()
    .from(eventTimeSlots)
    .where(eq(eventTimeSlots.eventId, eventId))
    .orderBy(asc(eventTimeSlots.sortOrder))
}

function rejection(work: Promise<unknown>) {
  return work.then(
    () => null,
    (error: unknown) => String((error as { cause?: unknown }).cause ?? error),
  )
}

describe('event writes', () => {
  it('creates an event with its slots and reads them back in order', async () => {
    const id = await createEventWithSlots(hackathon)

    const [event] = await getEvents()
    expect(event).toMatchObject({ id, title: 'Hackathon', date: '2099-10-10', endDate: '2099-10-12' })
    expect(event.slots.map(({ startDate, endDate, startTime, endTime, sortOrder }) => ({ startDate, endDate, startTime, endTime, sortOrder }))).toEqual([
      { startDate: '2099-10-10', endDate: '2099-10-11', startTime: '18:00:00', endTime: '20:00:00', sortOrder: 0 },
      { startDate: '2099-10-12', endDate: '2099-10-12', startTime: '19:00:00', endTime: '20:00:00', sortOrder: 1 },
    ])
  })

  it('creates a one-day event with no slots, as before', async () => {
    const id = await createEventWithSlots({ ...hackathon, endDate: null, time: '6 PM', slots: [] })
    expect(await slotsOf(id)).toEqual([])
    const [event] = await getEvents()
    expect(event).toMatchObject({ endDate: null, time: '6 PM', slots: [] })
  })

  it('replaces every slot on update and clears them all when none are sent', async () => {
    const id = await createEventWithSlots(hackathon)

    expect(
      await updateEventWithSlots(id, {
        ...hackathon,
        slots: [{ startDate: '2099-10-11', endDate: '2099-10-11', startTime: '09:30', endTime: '10:00' }],
      }),
    ).toEqual({ status: 'saved' })
    expect((await slotsOf(id)).map((slot) => slot.startTime)).toEqual(['09:30:00'])

    expect(await updateEventWithSlots(id, { ...hackathon, endDate: null, time: '7 PM', slots: [] })).toEqual({ status: 'saved' })
    expect(await slotsOf(id)).toEqual([])
    const [row] = await getDb().select().from(events).where(eq(events.id, id))
    expect(row).toMatchObject({ endDate: null, time: '7 PM' })
  })

  it('reports a missing event on update instead of writing orphan slots', async () => {
    expect(await updateEventWithSlots(999, hackathon)).toEqual({ status: 'missing' })
    expect(await getDb().select().from(eventTimeSlots)).toEqual([])
  })

  it('deletes an event’s slots with it', async () => {
    const id = await createEventWithSlots(hackathon)
    await getDb().delete(events).where(eq(events.id, id))
    expect(await slotsOf(id)).toEqual([])
  })
})

async function waitForQueuedWriter() {
  await expect
    .poll(async () => {
      const { rows } = await getDb().execute<{ waiting: number }>(
        sql`select count(*)::int as waiting from pg_locks where not granted`,
      )
      return rows[0].waiting
    })
    .toBeGreaterThan(0)
}

describe('capacity against a concurrent RSVP', () => {
  it('counts an RSVP that committed while the update waited for the event lock', async () => {
    const [first, second] = await Promise.all([createMember(), createMember()])
    const event = await createEvent({ capacity: 5 })
    await getDb().insert(eventRsvps).values({ eventId: event.id, memberId: first.id })

    const [rsvpOutcome, updateOutcome] = await raceBehindLockedEvent<unknown>(event.id, [
      () => rsvp(second.id, event.id),
      async () => {
        await waitForQueuedWriter()
        return updateEventWithSlots(event.id, { ...hackathon, capacity: 1 })
      },
    ])

    expect(rsvpOutcome).toBe('going')
    expect(updateOutcome).toEqual({ status: 'over-capacity', going: 2, date: event.date })
    const [row] = await getDb().select().from(events).where(eq(events.id, event.id))
    expect(row.capacity).toBe(5)
  }, 60_000)
})

describe('event date CHECK constraints', () => {
  it('refuses an end date before the start date', async () => {
    expect(await rejection(createEvent({ date: '2099-10-10', endDate: '2099-10-09' }))).toMatch(
      /events_end_date_after_start/,
    )
    expect(await createEvent({ date: '2099-10-10', endDate: '2099-10-10' })).toMatchObject({ endDate: '2099-10-10' })
  })

  it('refuses a slot that ends before it starts, by day or by time', async () => {
    const event = await createEvent()
    const slot = { eventId: event.id, startDate: '2099-01-01', endDate: '2099-01-01', startTime: '18:00', endTime: '20:00' }

    expect(await rejection(getDb().insert(eventTimeSlots).values({ ...slot, endDate: '2098-12-31' }))).toMatch(
      /event_time_slots_end_date_after_start/,
    )
    expect(await rejection(getDb().insert(eventTimeSlots).values({ ...slot, endTime: '18:00' }))).toMatch(
      /event_time_slots_end_time_after_start/,
    )
    expect(await rejection(getDb().insert(eventTimeSlots).values({ ...slot, endTime: '17:00' }))).toMatch(
      /event_time_slots_end_time_after_start/,
    )
    expect(await rejection(getDb().insert(eventTimeSlots).values(slot))).toBeNull()
  })
})

describe('weekly series', () => {
  const today = todayInDenver(new Date())
  const weeks = [-14, -7, 0, 7, 14].map((days) => addDays(today, days))
  const later = { later: true, today }

  const meeting: EventInput = {
    title: 'Chapter meeting',
    description: 'Weekly',
    location: 'Room 1',
    type: 'Social',
    date: weeks[0],
    endDate: addDays(weeks[0], 1),
    time: null,
    capacity: 30,
    slots: [
      { startDate: weeks[0], endDate: weeks[0], startTime: '18:00', endTime: '19:00' },
      { startDate: addDays(weeks[0], 1), endDate: addDays(weeks[0], 1), startTime: '09:00', endTime: '10:00' },
    ],
  }

  async function seriesRows() {
    return getDb().select().from(events).orderBy(asc(events.date))
  }

  async function addRsvps(eventId: number, total: number) {
    const people = await Promise.all(Array.from({ length: total }, () => createMember()))
    await getDb()
      .insert(eventRsvps)
      .values(people.map((person) => ({ eventId, memberId: person.id })))
  }

  it('creates one event per week, linked by one series id, each with its own copy of the slots', async () => {
    const ids = await createEventSeries(meeting, weeks)

    const rows = await seriesRows()
    expect(rows.map((row) => row.id)).toEqual(ids)
    expect(new Set(rows.map((row) => row.seriesId)).size).toBe(1)
    expect(rows[0].seriesId).toMatch(/^[0-9a-f-]{36}$/)
    expect(rows.map((row) => [row.date, row.endDate, row.capacity, row.title])).toEqual(
      weeks.map((date) => [date, addDays(date, 1), 30, 'Chapter meeting']),
    )
    for (const [index, id] of ids.entries()) {
      expect((await slotsOf(id)).map((slot) => [slot.startDate, slot.startTime])).toEqual([
        [weeks[index], '18:00:00'],
        [addDays(weeks[index], 1), '09:00:00'],
      ])
    }
  })

  it('writes no week at all when one row is refused', async () => {
    const broken = { ...meeting, slots: [{ ...meeting.slots[0], endTime: '17:00' }] }
    expect(await rejection(createEventSeries(broken, weeks))).toMatch(/event_time_slots_end_time_after_start/)
    expect(await getDb().select().from(events)).toEqual([])
    expect(await getDb().select().from(eventTimeSlots)).toEqual([])
  })

  it('edits only the chosen week when asked to', async () => {
    const ids = await createEventSeries(meeting, weeks)
    const chosen = { ...meeting, date: weeks[2], endDate: null, slots: [] }

    expect(await updateEventWithSlots(ids[2], { ...chosen, title: 'Moved' })).toEqual({ status: 'saved' })

    expect((await seriesRows()).map((row) => row.title)).toEqual([
      'Chapter meeting',
      'Chapter meeting',
      'Moved',
      'Chapter meeting',
      'Chapter meeting',
    ])
    expect(await slotsOf(ids[3])).toHaveLength(2)
  })

  it('edits the chosen week and every later one, moves them by the same days, and leaves past weeks alone', async () => {
    const ids = await createEventSeries(meeting, weeks)
    const pastBefore = (await seriesRows()).slice(0, 2)
    const pastSlotsBefore = await Promise.all(ids.slice(0, 2).map(slotsOf))
    const moved = addDays(weeks[2], 1)

    expect(
      await updateEventWithSlots(
        ids[2],
        {
          ...meeting,
          title: 'Chapter meeting (Fridays)',
          date: moved,
          endDate: null,
          capacity: 40,
          slots: [{ startDate: moved, endDate: moved, startTime: '17:00', endTime: '18:30' }],
        },
        later,
      ),
    ).toEqual({ status: 'saved' })

    const rows = await seriesRows()
    expect(rows.slice(0, 2)).toEqual(pastBefore)
    expect(await Promise.all(ids.slice(0, 2).map(slotsOf))).toEqual(pastSlotsBefore)
    expect(rows.slice(2).map((row) => [row.id, row.date, row.endDate, row.title, row.capacity])).toEqual(
      [2, 3, 4].map((index) => [ids[index], addDays(weeks[index], 1), null, 'Chapter meeting (Fridays)', 40]),
    )
    for (const index of [2, 3, 4]) {
      expect((await slotsOf(ids[index])).map((slot) => [slot.startDate, slot.startTime, slot.endTime])).toEqual([
        [addDays(weeks[index], 1), '17:00:00', '18:30:00'],
      ])
    }
  })

  it('refuses a series capacity below any week’s RSVPs, names the busiest week and changes nothing', async () => {
    const ids = await createEventSeries(meeting, weeks)
    await Promise.all([addRsvps(ids[0], 9), addRsvps(ids[2], 1), addRsvps(ids[3], 3), addRsvps(ids[4], 2)])
    const before = await seriesRows()
    const slotsBefore = await Promise.all(ids.map(slotsOf))

    expect(
      await updateEventWithSlots(ids[2], { ...meeting, date: weeks[2], endDate: null, slots: [], title: 'X', capacity: 2 }, later),
    ).toEqual({ status: 'over-capacity', going: 3, date: weeks[3] })

    expect(await seriesRows()).toEqual(before)
    expect(await Promise.all(ids.map(slotsOf))).toEqual(slotsBefore)
  })

  it('lets a series capacity fit every later week even when a past week had more RSVPs', async () => {
    const ids = await createEventSeries(meeting, weeks)
    await Promise.all([addRsvps(ids[0], 9), addRsvps(ids[3], 3)])

    expect(
      await updateEventWithSlots(ids[2], { ...meeting, date: weeks[2], endDate: null, slots: [], capacity: 3 }, later),
    ).toEqual({ status: 'saved' })
    expect((await seriesRows()).map((row) => row.capacity)).toEqual([30, 30, 3, 3, 3])
  })

  it('deletes just the chosen week, or it and every later week, never a past one', async () => {
    const ids = await createEventSeries(meeting, weeks)
    const other = await createEventSeries({ ...meeting, title: 'Study hall' }, weeks.slice(2))
    await Promise.all([addRsvps(ids[0], 4), addRsvps(ids[2], 2), addRsvps(ids[3], 1)])

    expect(await deleteEvents(ids[4])).toBe(1)
    const remaining = await getEvents()
    const chosen = remaining.find((event) => event.id === ids[2])!
    const warned = laterInSeries(remaining, chosen, today).map((event) => event.id)
    expect(warned).toEqual([ids[3]])

    expect(await deleteEvents(ids[2], later)).toBe(1 + warned.length)

    const left = await seriesRows()
    expect(left.filter((row) => row.title === 'Chapter meeting').map((row) => row.id)).toEqual(ids.slice(0, 2))
    expect(left.filter((row) => row.title === 'Study hall').map((row) => row.id)).toEqual(other)
    expect(await getDb().select().from(eventRsvps).where(eq(eventRsvps.eventId, ids[0]))).toHaveLength(4)
    expect(await getDb().select().from(eventRsvps)).toHaveLength(4)
    expect(await slotsOf(ids[3])).toEqual([])
  })

  it('treats a chosen week that has ended as this event only, so no other week changes', async () => {
    const ids = await createEventSeries({ ...meeting, endDate: null, slots: [] }, weeks)

    expect(
      await updateEventWithSlots(ids[0], { ...meeting, date: weeks[0], endDate: null, slots: [], title: 'Renamed' }, later),
    ).toEqual({ status: 'saved' })
    expect((await seriesRows()).map((row) => row.title)).toEqual([
      'Renamed',
      'Chapter meeting',
      'Chapter meeting',
      'Chapter meeting',
      'Chapter meeting',
    ])

    expect(await deleteEvents(ids[0], later)).toBe(1)
    expect((await seriesRows()).map((row) => row.id)).toEqual(ids.slice(1))
  })

  it('leaves out a later week that has ended while the chosen week is still running', async () => {
    const seriesId = crypto.randomUUID()
    const running = await createEvent({ seriesId, date: '2099-01-01', endDate: '2099-01-06', title: 'Running' })
    const ended = await createEvent({ seriesId, date: '2099-01-02', title: 'Ended' })
    const coming = await createEvent({ seriesId, date: '2099-01-08', title: 'Coming' })
    const scope = { later: true, today: '2099-01-04' }

    expect(
      await updateEventWithSlots(
        running.id,
        { ...meeting, date: '2099-01-01', endDate: '2099-01-06', slots: [], title: 'Renamed' },
        scope,
      ),
    ).toEqual({ status: 'saved' })
    expect((await seriesRows()).map((row) => [row.id, row.title])).toEqual([
      [running.id, 'Renamed'],
      [ended.id, 'Ended'],
      [coming.id, 'Renamed'],
    ])

    expect(await deleteEvents(running.id, scope)).toBe(2)
    expect((await seriesRows()).map((row) => row.id)).toEqual([ended.id])
  })

  it('lists only the next week of each series as upcoming and every ended week as past', async () => {
    const ids = await createEventSeries({ ...meeting, endDate: null, slots: [] }, weeks)
    const study = await createEventSeries({ ...meeting, title: 'Study hall', endDate: null, slots: [] }, weeks.slice(3))
    const oneOff = await createEventWithSlots({ ...meeting, title: 'Mixer', date: weeks[4], endDate: null, slots: [] })

    const { upcoming, past } = publicEventListings(await getEvents(), today)

    expect(upcoming.map((event) => event.id)).toEqual([ids[2], study[0], oneOff])
    expect(past.map((event) => event.id)).toEqual([ids[1], ids[0]])
  })
})
