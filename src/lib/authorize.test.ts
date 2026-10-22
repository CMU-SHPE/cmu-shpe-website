import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type AdminRow = { id: number; email: string; name: string; role: 'admin' | 'master'; passwordHash: string }

const fake = vi.hoisted(() => {
  const state = {
    ops: [] as string[],
    counts: { emailAttempts: 1, ipAttempts: 1 } as Record<string, number>,
    admin: null as AdminRow | null,
    limitDelayMs: 0,
  }
  const db = {
    insert: () => ({
      values: async () => {
        state.ops.push('insert attempt')
      },
    }),
    delete: () => ({
      where: async (condition: { expiredBefore?: unknown }) => {
        state.ops.push(condition?.expiredBefore ? 'purge expired attempts' : 'clear email attempts')
      },
    }),
    select: (fields: Record<string, unknown>) => {
      const [key] = Object.keys(fields)
      const query = {
        from: () => query,
        where: () => {
          if (key in state.counts) {
            state.ops.push(`count ${key}`)
            return Promise.resolve([{ [key]: state.counts[key] }])
          }
          return query
        },
        limit: async () => {
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
vi.mock('drizzle-orm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('drizzle-orm')>()),
  lt: (_column: unknown, value: unknown) => ({ expiredBefore: value }),
}))
vi.mock('bcryptjs', () => ({ default: { compare: fake.compare } }))

import { authorizeAdmin } from './authorize'

const ana: AdminRow = { id: 2, email: 'ana@example.com', name: 'Ana', role: 'admin', passwordHash: '$2b$12$real' }
const credentials = { email: 'Ana@Example.com', password: 'correct horse battery' }

beforeEach(() => {
  fake.state.ops = []
  fake.state.counts = { emailAttempts: 1, ipAttempts: 1 }
  fake.state.admin = null
  fake.state.limitDelayMs = 0
  fake.compare.mockReset()
  fake.compare.mockResolvedValue(false)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
})

describe('authorizeAdmin', () => {
  it('records the attempt and purges expired ones before counting', async () => {
    await authorizeAdmin(credentials, '203.0.113.7')
    expect(fake.state.ops.slice(0, 4)).toEqual([
      'insert attempt',
      'purge expired attempts',
      'count emailAttempts',
      'count ipAttempts',
    ])
  })

  it('stops before the password check once throttled, after still purging expired attempts', async () => {
    fake.state.counts.emailAttempts = 6
    await expect(authorizeAdmin(credentials, '203.0.113.7')).resolves.toBeNull()
    expect(fake.state.ops).toEqual(['insert attempt', 'purge expired attempts', 'count emailAttempts', 'count ipAttempts'])
    expect(fake.compare).not.toHaveBeenCalled()
  })

  it('purges expired attempts exactly once on every path', async () => {
    const scenarios: (() => void)[] = [
      () => (fake.state.counts.emailAttempts = 6),
      () => (fake.state.admin = null),
      () => (fake.state.admin = ana),
      () => {
        fake.state.admin = ana
        fake.compare.mockResolvedValue(true)
      },
    ]
    for (const arrange of scenarios) {
      fake.state.ops = []
      fake.state.counts = { emailAttempts: 1, ipAttempts: 1 }
      fake.state.admin = null
      fake.compare.mockResolvedValue(false)
      arrange()
      await authorizeAdmin(credentials, null)
      expect(fake.state.ops.filter((op) => op === 'purge expired attempts')).toHaveLength(1)
    }
  })

  it('runs bcrypt for unknown emails so timing does not reveal admin accounts', async () => {
    await expect(authorizeAdmin(credentials, null)).resolves.toBeNull()
    expect(fake.compare).toHaveBeenCalledTimes(1)
    expect(fake.compare.mock.calls[0][1]).toMatch(/^\$2b\$12\$/)
  })

  it('keeps the attempt on a wrong password', async () => {
    fake.state.admin = ana
    await expect(authorizeAdmin(credentials, null)).resolves.toBeNull()
    expect(fake.compare).toHaveBeenCalledWith('correct horse battery', ana.passwordHash)
  })

  it('returns the admin and clears their attempts on success', async () => {
    fake.state.admin = ana
    fake.compare.mockResolvedValue(true)
    await expect(authorizeAdmin(credentials, null)).resolves.toEqual({
      id: '2',
      email: 'ana@example.com',
      name: 'Ana',
      role: 'admin',
      authTime: expect.any(Number),
    })
    expect(fake.state.ops.at(-1)).toBe('clear email attempts')
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
    const result = await authorizeAdmin(credentials, null)
    expect(result?.authTime).toBe(start)
    expect(Date.now()).toBe(start + 40 + 250)
  })

  it('lets the 5th attempt with the right password through after 4 failures', async () => {
    fake.state.admin = ana
    fake.state.counts.emailAttempts = 5
    fake.compare.mockResolvedValue(true)
    await expect(authorizeAdmin(credentials, null)).resolves.toMatchObject({ id: '2' })
  })

  it('throttles the 6th attempt after 5 failures even with the right password', async () => {
    fake.state.admin = ana
    fake.state.counts.emailAttempts = 6
    fake.compare.mockResolvedValue(true)
    await expect(authorizeAdmin(credentials, null)).resolves.toBeNull()
    expect(fake.compare).not.toHaveBeenCalled()
  })

  it('applies the same boundary to the per-ip count', async () => {
    fake.state.admin = ana
    fake.compare.mockResolvedValue(true)
    fake.state.counts.ipAttempts = 20
    await expect(authorizeAdmin(credentials, '203.0.113.7')).resolves.toMatchObject({ id: '2' })
    fake.state.counts.ipAttempts = 21
    await expect(authorizeAdmin(credentials, '203.0.113.7')).resolves.toBeNull()
  })

  it('rejects malformed credentials without touching the database', async () => {
    await expect(authorizeAdmin({ email: 'not-an-email', password: 'x' }, null)).resolves.toBeNull()
    expect(fake.state.ops).toEqual([])
  })
})
