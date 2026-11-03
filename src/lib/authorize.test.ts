import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type AdminRow = {
  id: number
  email: string
  name: string
  role: 'admin' | 'master'
  passwordHash: string
  passwordChangedAt?: Date | null
}
type MemberRow = {
  id: number
  email: string
  name: string
  role: 'supporter' | 'sponsor'
  passwordHash: string
  emailConfirmedAt: Date | null
}

const fake = vi.hoisted(() => {
  const state = {
    ops: [] as string[],
    counts: { perEmailAndIp: 1, perEmail: 1, perIp: 1 } as Record<string, number>,
    stored: [] as unknown[],
    admin: null as AdminRow | null,
    member: null as MemberRow | null,
    limitDelayMs: 0,
  }
  const db = {
    delete: () => ({
      where: async () => {
        state.ops.push('delete attempts')
      },
    }),
    select: () => {
      let table = ''
      const query = {
        from: (source: Record<symbol, string>) => {
          table = source[Symbol.for('drizzle:Name')]
          return query
        },
        where: () => query,
        limit: async () => {
          if (table === 'members') {
            state.ops.push('find member')
            return state.member ? [state.member] : []
          }
          state.ops.push('find admin')
          if (state.limitDelayMs) vi.setSystemTime(Date.now() + state.limitDelayMs)
          return state.admin ? [state.admin] : []
        },
      }
      return query
    },
  }
  return { state, db, compare: vi.fn<(password: string, hash: string) => Promise<boolean>>() }
})

vi.mock('@/db', () => ({ getDb: () => fake.db }))
vi.mock('@/lib/throttle-store', () => ({
  storeIfAllowed: async (attempt: { limits: Record<string, number>; skipEmailCeiling?: boolean }) => {
    fake.state.ops.push('store attempt')
    fake.state.stored.push(attempt)
    const over = (key: string) => fake.state.counts[key] > attempt.limits[key]
    return { throttled: over('perEmailAndIp') || (!attempt.skipEmailCeiling && over('perEmail')) || over('perIp') }
  },
}))
vi.mock('bcryptjs', () => ({ default: { compare: fake.compare } }))

import { authorizeCredentials } from './authorize'
import { withKnownDevice } from './known-device'
import { LOGIN_LIMITS } from './login-throttle'

const ana: AdminRow = { id: 2, email: 'ana@example.com', name: 'Ana', role: 'admin', passwordHash: '$2b$12$real' }
const credentials = { email: 'Ana@Example.com', password: 'correct horse battery' }
const anaDevice = { kind: 'admin' as const, id: 2, email: 'ana@example.com', passwordChangedAt: null }
const mia: MemberRow = {
  id: 2,
  email: 'mia@example.com',
  name: 'Mia',
  role: 'supporter',
  passwordHash: '$2b$12$member',
  emailConfirmedAt: new Date('2026-10-01T00:00:00.000Z'),
}
const miaCredentials = { email: 'Mia@Example.com', password: 'member horse battery' }

beforeEach(() => {
  fake.state.ops = []
  fake.state.counts = { perEmailAndIp: 1, perEmail: 1, perIp: 1 }
  fake.state.stored = []
  fake.state.admin = null
  fake.state.member = null
  fake.state.limitDelayMs = 0
  fake.compare.mockReset()
  fake.compare.mockResolvedValue(false)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
})

describe('authorizeCredentials', () => {
  it('stores the attempt under the login limits, keyed on the normalised email and source', async () => {
    await authorizeCredentials(credentials, '203.0.113.7, 10.0.0.1')
    expect(fake.state.ops.slice(0, 3)).toEqual(['find admin', 'find member', 'store attempt'])
    expect(fake.state.stored[0]).toMatchObject({
      flow: 'login',
      columns: { email: 'ana@example.com', ip: '203.0.113.7' },
      limits: LOGIN_LIMITS,
      skipEmailCeiling: false,
    })
  })

  it('reads both account tables, then stops before the password check once throttled', async () => {
    fake.state.counts.perEmailAndIp = 6
    await expect(authorizeCredentials(credentials, '203.0.113.7')).resolves.toBeNull()
    expect(fake.state.ops).toEqual(['find admin', 'find member', 'store attempt'])
    expect(fake.compare).not.toHaveBeenCalled()
  })

  it('stores exactly one attempt on every path', async () => {
    const scenarios: (() => void)[] = [
      () => (fake.state.counts.perEmailAndIp = 6),
      () => (fake.state.admin = null),
      () => (fake.state.admin = ana),
      () => {
        fake.state.admin = ana
        fake.compare.mockResolvedValue(true)
      },
    ]
    for (const arrange of scenarios) {
      fake.state.ops = []
      fake.state.counts = { perEmailAndIp: 1, perEmail: 1, perIp: 1 }
      fake.state.admin = null
      fake.compare.mockResolvedValue(false)
      arrange()
      await authorizeCredentials(credentials, null)
      expect(fake.state.ops.filter((op) => op === 'store attempt')).toHaveLength(1)
    }
  })

  describe('a known-device cookie', () => {
    beforeEach(() => {
      vi.stubEnv('AUTH_SECRET', 'a test secret for known devices')
      fake.state.admin = ana
      fake.compare.mockResolvedValue(true)
      fake.state.counts.perEmail = LOGIN_LIMITS.perEmail + 1
    })
    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('lets its own account past a full per-email ceiling', async () => {
      const cookie = withKnownDevice(undefined, anaDevice)!
      await expect(authorizeCredentials(credentials, '203.0.113.7', cookie)).resolves.toMatchObject({ id: '2' })
      expect(fake.state.stored[0]).toMatchObject({ skipEmailCeiling: true })
    })

    it('does nothing for another account', async () => {
      const cookie = withKnownDevice(undefined, { ...anaDevice, id: 9, email: 'someone@example.com' })!
      await expect(authorizeCredentials(credentials, '203.0.113.7', cookie)).resolves.toBeNull()
      expect(fake.state.stored[0]).toMatchObject({ skipEmailCeiling: false })
    })

    it('does nothing when forged or tampered with', async () => {
      const real = withKnownDevice(undefined, anaDevice)!
      const tampered = `${real.slice(0, -2)}${real.endsWith('AA') ? 'AB' : 'AA'}`
      for (const cookie of [tampered, 'ana@example.com', '', 'x'.repeat(43), `${real}x`]) {
        await expect(authorizeCredentials(credentials, '203.0.113.7', cookie)).resolves.toBeNull()
      }
      expect(fake.compare).not.toHaveBeenCalled()
    })

    it('stops working once the password changes', async () => {
      const cookie = withKnownDevice(undefined, anaDevice, Date.now() - 1000)!
      fake.state.admin = { ...ana, passwordChangedAt: new Date() }
      await expect(authorizeCredentials(credentials, '203.0.113.7', cookie)).resolves.toBeNull()
      expect(fake.compare).not.toHaveBeenCalled()
    })

    it('still meets the per-source limit', async () => {
      fake.state.counts = { perEmailAndIp: LOGIN_LIMITS.perEmailAndIp + 1, perEmail: 1, perIp: 1 }
      const cookie = withKnownDevice(undefined, anaDevice)!
      await expect(authorizeCredentials(credentials, '203.0.113.7', cookie)).resolves.toBeNull()
    })
  })

  it('runs bcrypt for unknown emails so timing does not reveal admin accounts', async () => {
    await expect(authorizeCredentials(credentials, null)).resolves.toBeNull()
    expect(fake.compare).toHaveBeenCalledTimes(1)
    expect(fake.compare.mock.calls[0][1]).toMatch(/^\$2b\$12\$/)
  })

  it('keeps the attempt on a wrong password', async () => {
    fake.state.admin = ana
    await expect(authorizeCredentials(credentials, null)).resolves.toBeNull()
    expect(fake.compare).toHaveBeenCalledWith('correct horse battery', ana.passwordHash)
  })

  it('returns the admin and clears their attempts on success', async () => {
    fake.state.admin = ana
    fake.compare.mockResolvedValue(true)
    await expect(authorizeCredentials(credentials, null)).resolves.toEqual({
      id: '2',
      email: 'ana@example.com',
      name: 'Ana',
      kind: 'admin',
      role: 'admin',
      authTime: expect.any(Number),
    })
    expect(fake.state.ops.at(-1)).toBe('delete attempts')
  })

  it('takes authTime before reading the admin row, not after the slow password check', async () => {
    const start = 1_792_000_000_000
    vi.useFakeTimers({ now: start })
    fake.state.admin = ana
    fake.state.limitDelayMs = 40
    fake.compare.mockImplementation(async () => {
      vi.setSystemTime(Date.now() + 250)
      return true
    })
    const result = await authorizeCredentials(credentials, null)
    expect(result?.authTime).toBe(start)
    expect(Date.now()).toBe(start + 40 + 250)
  })

  it('lets the 5th attempt with the right password through after 4 failures', async () => {
    fake.state.admin = ana
    fake.state.counts.perEmailAndIp = 5
    fake.compare.mockResolvedValue(true)
    await expect(authorizeCredentials(credentials, null)).resolves.toMatchObject({ id: '2' })
  })

  it('throttles the 6th attempt after 5 failures even with the right password', async () => {
    fake.state.admin = ana
    fake.state.counts.perEmailAndIp = 6
    fake.compare.mockResolvedValue(true)
    await expect(authorizeCredentials(credentials, null)).resolves.toBeNull()
    expect(fake.compare).not.toHaveBeenCalled()
  })

  it('applies the much higher per-email ceiling across sources', async () => {
    fake.state.admin = ana
    fake.compare.mockResolvedValue(true)
    fake.state.counts.perEmail = 50
    await expect(authorizeCredentials(credentials, '203.0.113.7')).resolves.toMatchObject({ id: '2' })
    fake.state.counts.perEmail = 51
    await expect(authorizeCredentials(credentials, '203.0.113.7')).resolves.toBeNull()
  })

  it('applies the same boundary to the per-ip count', async () => {
    fake.state.admin = ana
    fake.compare.mockResolvedValue(true)
    fake.state.counts.perIp = 50
    await expect(authorizeCredentials(credentials, '203.0.113.7')).resolves.toMatchObject({ id: '2' })
    fake.state.counts.perIp = 51
    await expect(authorizeCredentials(credentials, '203.0.113.7')).resolves.toBeNull()
  })

  it('rejects malformed credentials without touching the database', async () => {
    await expect(authorizeCredentials({ email: 'not-an-email', password: 'x' }, null)).resolves.toBeNull()
    expect(fake.state.ops).toEqual([])
  })

  it('signs in a confirmed member as a member when no admin has the email', async () => {
    fake.state.member = mia
    fake.compare.mockResolvedValue(true)
    await expect(authorizeCredentials(miaCredentials, null)).resolves.toEqual({
      id: '2',
      email: 'mia@example.com',
      name: 'Mia',
      kind: 'member',
      role: 'supporter',
      authTime: expect.any(Number),
    })
    expect(fake.compare).toHaveBeenCalledTimes(1)
    expect(fake.compare).toHaveBeenCalledWith('member horse battery', mia.passwordHash)
    expect(fake.state.ops.at(-1)).toBe('delete attempts')
  })

  it('signs in as the admin when a member row has the same email', async () => {
    fake.state.admin = ana
    fake.state.member = { ...mia, email: ana.email }
    fake.compare.mockResolvedValue(true)
    await expect(authorizeCredentials(credentials, null)).resolves.toMatchObject({ kind: 'admin', role: 'admin' })
    expect(fake.compare).toHaveBeenCalledTimes(1)
    expect(fake.compare).toHaveBeenCalledWith('correct horse battery', ana.passwordHash)
  })

  it('queries both tables for every email, so timing does not show which kind of account it is', async () => {
    for (const arrange of [() => (fake.state.admin = ana), () => (fake.state.member = mia), () => {}]) {
      fake.state.ops = []
      fake.state.admin = null
      fake.state.member = null
      arrange()
      await authorizeCredentials(credentials, null)
      expect(fake.state.ops.filter((op) => op.startsWith('find')).sort()).toEqual(['find admin', 'find member'])
    }
  })

  it('refuses an unconfirmed member with the right password, keeping the attempt', async () => {
    fake.state.member = { ...mia, emailConfirmedAt: null }
    fake.compare.mockResolvedValue(true)
    await expect(authorizeCredentials(miaCredentials, null)).resolves.toBeNull()
    expect(fake.compare).toHaveBeenCalledTimes(1)
    expect(fake.state.ops).not.toContain('delete attempts')
  })

  it('refuses a member with a wrong password, keeping the attempt', async () => {
    fake.state.member = mia
    await expect(authorizeCredentials(miaCredentials, null)).resolves.toBeNull()
    expect(fake.compare).toHaveBeenCalledTimes(1)
    expect(fake.state.ops).not.toContain('delete attempts')
  })

  it('checks both tables and runs exactly one bcrypt compare against the dummy hash for an unknown email', async () => {
    await expect(authorizeCredentials(miaCredentials, null)).resolves.toBeNull()
    expect(fake.compare).toHaveBeenCalledTimes(1)
    expect(fake.compare.mock.calls[0][1]).toMatch(/^\$2b\$12\$/)
    expect(fake.compare.mock.calls[0][1]).not.toBe(mia.passwordHash)
  })

  it('throttles members with the same login attempt limits as admins', async () => {
    fake.state.member = mia
    fake.state.counts.perEmailAndIp = 6
    fake.compare.mockResolvedValue(true)
    await expect(authorizeCredentials(miaCredentials, null)).resolves.toBeNull()
    expect(fake.compare).not.toHaveBeenCalled()
  })
})
