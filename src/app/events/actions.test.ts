// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  class Redirect extends Error {
    constructor(readonly url: string) {
      super(`REDIRECT ${url}`)
    }
  }
  const calls: string[] = []
  return {
    Redirect,
    calls,
    currentMember: vi.fn(),
    rsvp: vi.fn(async (memberId: number, eventId: number) => {
      calls.push(`rsvp ${memberId} ${eventId}`)
      return 'going' as const
    }),
    cancelRsvp: vi.fn(async (memberId: number, eventId: number) => {
      calls.push(`cancel ${memberId} ${eventId}`)
      return true
    }),
  }
})

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    mocks.calls.push(`redirect ${url}`)
    throw new mocks.Redirect(url)
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: (path: string) => mocks.calls.push(`revalidate ${path}`) }))
vi.mock('@/lib/member', () => ({ currentMember: mocks.currentMember }))
vi.mock('@/lib/rsvp', () => ({ rsvp: mocks.rsvp, cancelRsvp: mocks.cancelRsvp }))

import { cancelEventRsvp, rsvpToEvent } from './actions'

const member = { user: { id: '7', email: 'mia@example.com', kind: 'member', role: 'supporter', name: 'Mia' } }

beforeEach(() => {
  mocks.calls.length = 0
  mocks.currentMember.mockReset()
  mocks.rsvp.mockClear()
  mocks.cancelRsvp.mockClear()
})

describe.each([
  ['rsvpToEvent', rsvpToEvent],
  ['cancelEventRsvp', cancelEventRsvp],
])('%s', (_name, action) => {
  it('sends a visitor without a member session to /login before touching anything', async () => {
    mocks.currentMember.mockResolvedValue(null)
    await expect(action(3)).rejects.toMatchObject({ url: '/login' })
    expect(mocks.calls).toEqual(['redirect /login'])
  })

  it('refuses tampered event ids without a database call', async () => {
    mocks.currentMember.mockResolvedValue(member)
    for (const eventId of ['abc', -1, 0, 1.5, '1; drop table events', null, 2 ** 31]) {
      await action(eventId)
    }
    expect(mocks.calls).toEqual([])
  })
})

describe('rsvpToEvent', () => {
  it('RSVPs the session member, never a member id from the caller', async () => {
    mocks.currentMember.mockResolvedValue(member)
    const withFormArguments = rsvpToEvent as (...args: unknown[]) => Promise<unknown>
    await expect(withFormArguments('3', { memberId: 99 })).resolves.toEqual({ status: 'going' })
    expect(mocks.calls).toEqual(['rsvp 7 3', 'revalidate /events', 'revalidate /account'])
  })

  it('passes the outcome through', async () => {
    mocks.currentMember.mockResolvedValue(member)
    mocks.rsvp.mockResolvedValueOnce('full' as never)
    await expect(rsvpToEvent(3)).resolves.toEqual({ status: 'full' })
  })

  it('reports a malformed id as missing', async () => {
    mocks.currentMember.mockResolvedValue(member)
    await expect(rsvpToEvent('abc')).resolves.toEqual({ status: 'missing' })
  })
})

describe('cancelEventRsvp', () => {
  it('cancels for the session member and reports whether anything changed', async () => {
    mocks.currentMember.mockResolvedValue(member)
    await expect(cancelEventRsvp(3)).resolves.toEqual({ status: 'cancelled' })
    expect(mocks.calls).toEqual(['cancel 7 3', 'revalidate /events', 'revalidate /account'])

    mocks.cancelRsvp.mockResolvedValueOnce(false)
    await expect(cancelEventRsvp(3)).resolves.toEqual({ status: 'not-cancelled' })
  })
})
