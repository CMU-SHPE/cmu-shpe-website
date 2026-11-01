import { asc, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb } from '@/db'
import { eventRsvps, eventTimeSlots, events } from '@/db/schema'
import { createEvent as createEventRow, createMember, resetDb } from '@/test/db'

const mocks = vi.hoisted(() => {
  class Redirect extends Error {
    constructor(readonly url: string) {
      super(`REDIRECT ${url}`)
    }
  }
  return { Redirect }
})

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new mocks.Redirect(url)
  },
}))
vi.mock('@/lib/admin', () => ({ requireAdmin: vi.fn(async () => ({ user: { id: '1', kind: 'admin' } })) }))

import { createEvent, deleteEvent, updateEvent } from './actions'

beforeEach(resetDb)

const SLOTS = [
  { startDate: '2099-10-10', endDate: '2099-10-11', startTime: '18:00', endTime: '20:00' },
  { startDate: '2099-10-12', endDate: '2099-10-12', startTime: '19:00', endTime: '20:00' },
]

function eventForm(overrides: Record<string, string> = {}, slots = SLOTS) {
  const form = new FormData()
  const fields = {
    title: 'Hackathon',
    description: 'Build things',
    location: 'Lab',
    type: 'Workshop',
    date: '2099-10-10',
    endDate: '2099-10-12',
    time: '',
    capacity: '',
    ...overrides,
  }
  for (const [name, value] of Object.entries(fields)) form.set(name, value)
  for (const slot of slots) {
    form.append('slotStartDate', slot.startDate)
    form.append('slotEndDate', slot.endDate)
    form.append('slotStartTime', slot.startTime)
    form.append('slotEndTime', slot.endTime)
  }
  return form
}

async function redirectOf(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(mocks.Redirect)
  return (error as InstanceType<typeof mocks.Redirect>).url
}

async function eventRow(id: number) {
  const [row] = await getDb().select().from(events).where(eq(events.id, id))
  return row
}

async function slotsOf(eventId: number) {
  const rows = await getDb()
    .select()
    .from(eventTimeSlots)
    .where(eq(eventTimeSlots.eventId, eventId))
    .orderBy(asc(eventTimeSlots.sortOrder))
  return rows.map(({ startDate, endDate, startTime, endTime, sortOrder }) => ({
    startDate,
    endDate,
    startTime,
    endTime,
    sortOrder,
  }))
}

async function addRsvps(eventId: number, total: number) {
  const people = await Promise.all(Array.from({ length: total }, () => createMember()))
  await getDb()
    .insert(eventRsvps)
    .values(people.map((person) => ({ eventId, memberId: person.id })))
}

async function rsvpsOf(eventId: number) {
  return getDb().select().from(eventRsvps).where(eq(eventRsvps.eventId, eventId))
}

describe('createEvent', () => {
  it('saves a multi-day event with its slots and redirects', async () => {
    expect(await redirectOf(createEvent({}, eventForm({ capacity: '40' })))).toBe('/admin/events?saved=1')

    const [row] = await getDb().select().from(events)
    expect(row).toMatchObject({ title: 'Hackathon', date: '2099-10-10', endDate: '2099-10-12', capacity: 40, time: null })
    expect(await slotsOf(row.id)).toEqual([
      { startDate: '2099-10-10', endDate: '2099-10-11', startTime: '18:00:00', endTime: '20:00:00', sortOrder: 0 },
      { startDate: '2099-10-12', endDate: '2099-10-12', startTime: '19:00:00', endTime: '20:00:00', sortOrder: 1 },
    ])
  })

  it('refuses invalid input, keeps what was typed and writes nothing', async () => {
    const state = await createEvent({}, eventForm({ title: 'Kept', location: '', capacity: '0' }))

    expect(state.errors).toMatchObject({
      location: 'Enter a location of up to 200 characters.',
      capacity: 'Use a whole number from 1 to 10,000, or leave it blank for no limit.',
    })
    expect(state.values).toMatchObject({ title: 'Kept', capacity: '0' })
    expect(await getDb().select().from(events)).toEqual([])
    expect(await getDb().select().from(eventTimeSlots)).toEqual([])
  })
})

describe('updateEvent', () => {
  it('saves changes to a multi-day event and replaces its slots', async () => {
    const { id } = await createEventRow({ date: '2099-10-10', endDate: '2099-10-11', capacity: 5 })

    expect(await redirectOf(updateEvent(id, {}, eventForm({ title: 'Renamed' })))).toBe('/admin/events?saved=1')

    expect(await eventRow(id)).toMatchObject({ title: 'Renamed', endDate: '2099-10-12', capacity: null })
    expect((await slotsOf(id)).map((slot) => slot.startDate)).toEqual(['2099-10-10', '2099-10-12'])
  })

  it('refuses invalid input and leaves the event unchanged', async () => {
    const before = await createEventRow({ title: 'Original' })

    const state = await updateEvent(before.id, {}, eventForm({ title: '' }))

    expect(state.errors).toMatchObject({ title: 'Enter a title of up to 200 characters.' })
    expect(await eventRow(before.id)).toEqual(before)
  })

  it('redirects to the missing error when the event no longer exists and writes no slots', async () => {
    expect(await redirectOf(updateEvent(999, {}, eventForm()))).toBe('/admin/events?error=missing')
    expect(await getDb().select().from(eventTimeSlots)).toEqual([])
  })

  it('redirects to the invalid error for an id that cannot exist', async () => {
    expect(await redirectOf(updateEvent(-1, {}, eventForm()))).toBe('/admin/events?error=invalid')
  })

  it('refuses a capacity below the RSVP count, naming the count and changing nothing', async () => {
    const before = await createEventRow({ title: 'Original', date: '2099-10-10', endDate: '2099-10-12', capacity: 5 })
    await getDb()
      .insert(eventTimeSlots)
      .values({ eventId: before.id, startDate: '2099-10-11', endDate: '2099-10-11', startTime: '09:00', endTime: '10:00' })
    const slotsBefore = await slotsOf(before.id)
    await addRsvps(before.id, 3)

    const state = await updateEvent(before.id, {}, eventForm({ title: 'Renamed', capacity: '2' }))

    expect(state.errors).toEqual({ capacity: "This event already has 3 RSVPs, so the capacity can't be lower than 3." })
    expect(state.values).toMatchObject({ title: 'Renamed', capacity: '2' })
    expect(state.values?.slots).toHaveLength(SLOTS.length)
    expect(await eventRow(before.id)).toEqual(before)
    expect(await slotsOf(before.id)).toEqual(slotsBefore)
    expect(await rsvpsOf(before.id)).toHaveLength(3)
  })

  it('accepts a capacity equal to the RSVP count', async () => {
    const { id } = await createEventRow({ capacity: 5 })
    await addRsvps(id, 3)

    expect(await redirectOf(updateEvent(id, {}, eventForm({ capacity: '3' })))).toBe('/admin/events?saved=1')
    expect((await eventRow(id)).capacity).toBe(3)
  })

  it('accepts removing the limit from an event with RSVPs', async () => {
    const { id } = await createEventRow({ capacity: 3 })
    await addRsvps(id, 3)

    expect(await redirectOf(updateEvent(id, {}, eventForm({ capacity: '' })))).toBe('/admin/events?saved=1')
    expect((await eventRow(id)).capacity).toBeNull()
  })
})

describe('deleteEvent', () => {
  it('removes the event, its slots and its RSVPs, and leaves other events alone', async () => {
    const [doomed, kept] = await Promise.all([
      createEventRow({ date: '2099-10-10', endDate: '2099-10-12' }),
      createEventRow(),
    ])
    await getDb()
      .insert(eventTimeSlots)
      .values({ eventId: doomed.id, startDate: '2099-10-11', endDate: '2099-10-11', startTime: '09:00', endTime: '10:00' })
    await Promise.all([addRsvps(doomed.id, 2), addRsvps(kept.id, 1)])

    expect(await redirectOf(deleteEvent(doomed.id))).toBe('/admin/events?saved=1')

    expect(await eventRow(doomed.id)).toBeUndefined()
    expect(await slotsOf(doomed.id)).toEqual([])
    expect(await rsvpsOf(doomed.id)).toEqual([])
    expect(await eventRow(kept.id)).toBeDefined()
    expect(await rsvpsOf(kept.id)).toHaveLength(1)
  })

  it('redirects to the invalid error for an id that cannot exist', async () => {
    const { id } = await createEventRow()
    expect(await redirectOf(deleteEvent(0))).toBe('/admin/events?error=invalid')
    expect(await eventRow(id)).toBeDefined()
  })
})
