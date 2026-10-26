import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const state = {
    rows: [] as {
      email: string
      name: string
      role: 'supporter' | 'sponsor'
      emailConfirmedAt: Date | null
      passwordChangedAt: Date | null
    }[],
  }
  const limit = vi.fn(async () => state.rows)
  const query = { from: () => query, where: () => query, limit }
  return {
    state,
    limit,
    select: vi.fn(() => query),
    auth: vi.fn(),
    redirect: vi.fn((url: string) => {
      throw new Error(`REDIRECT ${url}`)
    }),
  }
})

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/db', () => ({ getDb: () => ({ select: mocks.select }) }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))

import { currentMember, requireMember } from './member'

const CONFIRMED = new Date('2026-10-01T00:00:00.000Z')
const memberSession = {
  user: { id: '7', name: 'Old Name', email: 'mia@example.com', kind: 'member', role: 'sponsor' },
  authTime: CONFIRMED.getTime() + 1000,
  expires: '',
}
const miaRow = {
  email: 'mia@example.com',
  name: 'Mia',
  role: 'supporter' as const,
  emailConfirmedAt: CONFIRMED,
  passwordChangedAt: null,
}

beforeEach(() => {
  mocks.auth.mockReset()
  mocks.select.mockClear()
  mocks.redirect.mockClear()
  mocks.state.rows = []
})

describe('currentMember', () => {
  it('returns the member with the role and name from the database', async () => {
    mocks.auth.mockResolvedValue(memberSession)
    mocks.state.rows = [miaRow]
    await expect(currentMember()).resolves.toMatchObject({
      user: { id: '7', kind: 'member', role: 'supporter', name: 'Mia' },
    })
  })

  it('refuses admin tokens and tokens with no kind without querying', async () => {
    mocks.state.rows = [miaRow]
    mocks.auth.mockResolvedValue({ ...memberSession, user: { ...memberSession.user, kind: 'admin', role: 'master' } })
    await expect(currentMember()).resolves.toBeNull()
    mocks.auth.mockResolvedValue({ ...memberSession, user: { ...memberSession.user, kind: undefined } })
    await expect(currentMember()).resolves.toBeNull()
    expect(mocks.select).not.toHaveBeenCalled()
  })

  it('returns null when signed out or misconfigured', async () => {
    mocks.auth.mockResolvedValue(null)
    await expect(currentMember()).resolves.toBeNull()
    mocks.auth.mockResolvedValue({ message: 'There was a problem with the server configuration.' })
    await expect(currentMember()).resolves.toBeNull()
    expect(mocks.select).not.toHaveBeenCalled()
  })

  it('returns null without querying for an invalid id or missing email', async () => {
    for (const id of ['abc', '0', '', '2147483648']) {
      mocks.auth.mockResolvedValue({ ...memberSession, user: { ...memberSession.user, id } })
      await expect(currentMember()).resolves.toBeNull()
    }
    mocks.auth.mockResolvedValue({ ...memberSession, user: { ...memberSession.user, email: undefined } })
    await expect(currentMember()).resolves.toBeNull()
    expect(mocks.select).not.toHaveBeenCalled()
  })

  it('returns null once the member row is deleted or the id belongs to someone else', async () => {
    mocks.auth.mockResolvedValue(memberSession)
    await expect(currentMember()).resolves.toBeNull()
    mocks.state.rows = [{ ...miaRow, email: 'someone-else@example.com' }]
    await expect(currentMember()).resolves.toBeNull()
  })

  it('refuses an account whose email is not confirmed', async () => {
    mocks.auth.mockResolvedValue(memberSession)
    mocks.state.rows = [{ ...miaRow, emailConfirmedAt: null }]
    await expect(currentMember()).resolves.toBeNull()
  })

  it('ends sessions signed in before the last password change', async () => {
    const changedAt = new Date(memberSession.authTime + 1)
    mocks.auth.mockResolvedValue(memberSession)
    mocks.state.rows = [{ ...miaRow, passwordChangedAt: changedAt }]
    await expect(currentMember()).resolves.toBeNull()
    mocks.state.rows = [{ ...miaRow, passwordChangedAt: new Date(memberSession.authTime) }]
    await expect(currentMember()).resolves.toMatchObject({ user: { id: '7' } })
  })
})

describe('requireMember', () => {
  it('redirects to /login without a member session', async () => {
    mocks.auth.mockResolvedValue(null)
    await expect(requireMember()).rejects.toThrow('REDIRECT /login')
  })

  it('redirects an admin to /login rather than treating them as a member', async () => {
    mocks.auth.mockResolvedValue({ ...memberSession, user: { ...memberSession.user, kind: 'admin' } })
    await expect(requireMember()).rejects.toThrow('REDIRECT /login')
  })

  it('returns the member session', async () => {
    mocks.auth.mockResolvedValue(memberSession)
    mocks.state.rows = [miaRow]
    await expect(requireMember()).resolves.toMatchObject({ user: { kind: 'member', name: 'Mia' } })
  })
})
