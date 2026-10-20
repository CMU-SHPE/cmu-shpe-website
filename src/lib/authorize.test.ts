import { beforeEach, describe, expect, it, vi } from 'vitest'

type AdminRow = { id: number; email: string; name: string; role: 'admin' | 'master'; passwordHash: string }

const fake = vi.hoisted(() => {
  const state = {
    ops: [] as string[],
    counts: { emailAttempts: 1, ipAttempts: 1 } as Record<string, number>,
    admin: null as AdminRow | null,
  }
  const db = {
    insert: () => ({
      values: async () => {
        state.ops.push('insert attempt')
      },
    }),
    delete: () => ({
      where: async () => {
        state.ops.push('delete attempts')
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
          return state.admin ? [state.admin] : []
        },
      }
      return query
    },
  }
  return { state, db, compare: vi.fn<(password: string, hash: string) => Promise<boolean>>() }
})

vi.mock('@/db', () => ({ getDb: () => fake.db }))
vi.mock('bcryptjs', () => ({ default: { compare: fake.compare } }))

import { authorizeAdmin } from './authorize'

const ana: AdminRow = { id: 2, email: 'ana@example.com', name: 'Ana', role: 'admin', passwordHash: '$2b$12$real' }
const credentials = { email: 'Ana@Example.com', password: 'correct horse battery' }

beforeEach(() => {
  fake.state.ops = []
  fake.state.counts = { emailAttempts: 1, ipAttempts: 1 }
  fake.state.admin = null
  fake.compare.mockReset()
  fake.compare.mockResolvedValue(false)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('authorizeAdmin', () => {
  it('records the attempt before counting so concurrent requests see each other', async () => {
    await authorizeAdmin(credentials, '203.0.113.7')
    expect(fake.state.ops.slice(0, 3)).toEqual(['insert attempt', 'count emailAttempts', 'count ipAttempts'])
  })

  it('stops before the password check once throttled', async () => {
    fake.state.counts.emailAttempts = 6
    await expect(authorizeAdmin(credentials, '203.0.113.7')).resolves.toBeNull()
    expect(fake.state.ops).not.toContain('find admin')
    expect(fake.compare).not.toHaveBeenCalled()
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
    })
    expect(fake.state.ops.at(-1)).toBe('delete attempts')
  })

  it('rejects malformed credentials without touching the database', async () => {
    await expect(authorizeAdmin({ email: 'not-an-email', password: 'x' }, null)).resolves.toBeNull()
    expect(fake.state.ops).toEqual([])
  })
})
