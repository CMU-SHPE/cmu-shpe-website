import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  class Redirect extends Error {
    constructor(readonly url: string) {
      super(`REDIRECT ${url}`)
    }
  }
  return { Redirect, auth: vi.fn() }
})

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new mocks.Redirect(url)
  },
}))

import { getDb } from '@/db'
import { eventRsvps } from '@/db/schema'
import { createAdmin, createEvent, createMember, resetDb } from '@/test/db'
import { cancelEventRsvp, rsvpToEvent } from './actions'

beforeEach(async () => {
  await resetDb()
  mocks.auth.mockReset()
})

function signInAs(kind: 'member' | 'admin', person: { id: number; email: string; name: string }) {
  mocks.auth.mockResolvedValue({
    user: { id: String(person.id), email: person.email, name: person.name, kind, role: kind === 'admin' ? 'admin' : 'supporter' },
    authTime: Date.now(),
    expires: '',
  })
}

async function rsvpRows() {
  return getDb().select({ eventId: eventRsvps.eventId, memberId: eventRsvps.memberId }).from(eventRsvps)
}

describe('RSVP server actions against the real database', () => {
  it('RSVPs and cancels for the signed-in member', async () => {
    const [member, event] = await Promise.all([createMember(), createEvent({ capacity: 3 })])
    signInAs('member', member)

    await expect(rsvpToEvent(event.id)).resolves.toEqual({ status: 'going' })
    expect(await rsvpRows()).toEqual([{ eventId: event.id, memberId: member.id }])

    await expect(cancelEventRsvp(event.id)).resolves.toEqual({ status: 'cancelled' })
    expect(await rsvpRows()).toEqual([])
  })

  it('refuses an admin session even when its id and email match a member', async () => {
    const [admin, event] = await Promise.all([createAdmin({ email: 'shared@shpe.test' }), createEvent()])
    const member = await createMember({ id: admin.id, email: admin.email })
    expect(member.id).toBe(admin.id)
    signInAs('admin', admin)

    await expect(rsvpToEvent(event.id)).rejects.toMatchObject({ url: '/login' })
    expect(await rsvpRows()).toEqual([])
  })

  it('refuses a member whose email is not confirmed, and a signed-out visitor', async () => {
    const [member, event] = await Promise.all([createMember({ confirmed: false }), createEvent()])
    signInAs('member', member)
    await expect(rsvpToEvent(event.id)).rejects.toMatchObject({ url: '/login' })

    mocks.auth.mockResolvedValue(null)
    await expect(rsvpToEvent(event.id)).rejects.toMatchObject({ url: '/login' })
    expect(await rsvpRows()).toEqual([])
  })

  it('only cancels the signed-in member’s own RSVP', async () => {
    const [member, other, event] = await Promise.all([createMember(), createMember(), createEvent()])
    await getDb().insert(eventRsvps).values({ eventId: event.id, memberId: other.id })
    signInAs('member', member)

    await expect(cancelEventRsvp(event.id)).resolves.toEqual({ status: 'not-cancelled' })
    expect(await getDb().select().from(eventRsvps).where(eq(eventRsvps.memberId, other.id))).toHaveLength(1)
  })
})
