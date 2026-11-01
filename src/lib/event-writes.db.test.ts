import { asc, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { getDb } from '@/db'
import { eventTimeSlots, events } from '@/db/schema'
import { createEvent, resetDb } from '@/test/db'
import type { EventInput } from './event-schema'
import { createEventWithSlots, updateEventWithSlots } from './event-writes'
import { getEvents } from './queries'

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
    ).toBe(true)
    expect((await slotsOf(id)).map((slot) => slot.startTime)).toEqual(['09:30:00'])

    expect(await updateEventWithSlots(id, { ...hackathon, endDate: null, time: '7 PM', slots: [] })).toBe(true)
    expect(await slotsOf(id)).toEqual([])
    const [row] = await getDb().select().from(events).where(eq(events.id, id))
    expect(row).toMatchObject({ endDate: null, time: '7 PM' })
  })

  it('reports a missing event on update instead of writing orphan slots', async () => {
    expect(await updateEventWithSlots(999, hackathon)).toBe(false)
    expect(await getDb().select().from(eventTimeSlots)).toEqual([])
  })

  it('deletes an event’s slots with it', async () => {
    const id = await createEventWithSlots(hackathon)
    await getDb().delete(events).where(eq(events.id, id))
    expect(await slotsOf(id)).toEqual([])
  })
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
