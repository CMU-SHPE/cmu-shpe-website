import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session, User } from 'next-auth'
import type { JWT } from '@auth/core/jwt'

type AdminRow = {
  id: number
  email: string
  name: string
  role: 'admin' | 'master'
  passwordHash: string
  canCreateAccounts: boolean
  passwordChangedAt: Date | null
}
type MemberRow = {
  id: number
  email: string
  name: string
  role: 'supporter' | 'sponsor'
  passwordHash: string
  emailConfirmedAt: Date | null
  passwordChangedAt: Date | null
}

const fake = vi.hoisted(() => {
  const state = {
    admins: [] as AdminRow[],
    members: [] as MemberRow[],
    counts: { emailAttempts: 1, ipAttempts: 1 } as Record<string, number>,
    ops: [] as string[],
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
      let table = ''
      const query = {
        from: (source: Record<symbol, string>) => {
          table = source[Symbol.for('drizzle:Name')]
          return query
        },
        where: (condition: { lookup?: { column: string; value: unknown } }) => {
          if (key in state.counts) {
            state.ops.push(`count ${key}`)
            return Promise.resolve([{ [key]: state.counts[key] }])
          }
          const lookup = condition?.lookup
          return {
            limit: async () => {
              state.ops.push(`select ${table}`)
              const rows: Record<string, unknown>[] = table === 'admins' ? state.admins : table === 'members' ? state.members : []
              const match = rows.filter((row) => lookup && row[lookup.column] === lookup.value)
              return match.map((row) => Object.fromEntries(Object.keys(fields).map((field) => [field, row[field]])))
            },
          }
        },
      }
      return query
    },
  }
  return {
    state,
    db,
    getDb: vi.fn(() => db),
    auth: vi.fn(),
    compare: vi.fn<(password: string, hash: string) => Promise<boolean>>(),
    redirect: vi.fn((url: string) => {
      throw new Error(`REDIRECT ${url}`)
    }),
  }
})

vi.mock('@/auth', () => ({ auth: fake.auth }))
vi.mock('@/db', () => ({ getDb: fake.getDb }))
vi.mock('next/navigation', () => ({ redirect: fake.redirect }))
vi.mock('bcryptjs', () => ({ default: { compare: fake.compare } }))
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    lt: (_column: unknown, value: unknown) => ({ expiredBefore: value }),
    eq: (column: { name: string }, value: unknown) => ({
      lookup: { column: column.name.replace(/_(\w)/g, (_, c: string) => c.toUpperCase()), value },
    }),
  }
})

import { jwtCallback, sessionCallback } from './auth-callbacks'
import { authorizeCredentials, type AuthorizedUser } from './authorize'
import { currentAdmin, requireAccountCreator, requireAdmin, requireMaster } from './admin'
import { currentMember, requireMember } from './member'

type JwtParams = Parameters<typeof jwtCallback>[0]
type SessionParams = Parameters<typeof sessionCallback>[0]

const SIGN_IN = 1_792_000_000_000

const max: AdminRow = {
  id: 1,
  email: 'max@example.com',
  name: 'Max',
  role: 'master',
  passwordHash: '$2b$12$admin-hash',
  canCreateAccounts: true,
  passwordChangedAt: null,
}
const mia: MemberRow = {
  id: 7,
  email: 'mia@example.com',
  name: 'Mia',
  role: 'supporter',
  passwordHash: '$2b$12$member-hash',
  emailConfirmedAt: new Date(SIGN_IN - 60_000),
  passwordChangedAt: null,
}

async function signInToken(user: AuthorizedUser): Promise<JWT> {
  const defaultToken = { name: user.name, email: user.email, picture: undefined, sub: user.id }
  const token = await jwtCallback({
    token: defaultToken,
    user: user as User,
    account: null,
    trigger: 'signIn',
  } as JwtParams)
  if (!token) throw new Error('jwt callback dropped the token')
  return token
}

async function readSession(token: JWT, update?: Record<string, unknown>): Promise<Session> {
  const refreshed = await jwtCallback({
    token,
    session: update,
    ...(update ? { trigger: 'update' } : {}),
  } as JwtParams)
  if (!refreshed) throw new Error('jwt callback dropped the token')
  const session = {
    user: { name: refreshed.name, email: refreshed.email, image: refreshed.picture },
    expires: new Date(SIGN_IN + 86_400_000).toISOString(),
  }
  return sessionCallback({ session, token: refreshed } as unknown as SessionParams) as Promise<Session>
}

async function signedInAs(user: AuthorizedUser) {
  fake.auth.mockResolvedValue(await readSession(await signInToken(user)))
}

function adminUser(row: AdminRow): AuthorizedUser {
  return { id: String(row.id), email: row.email, name: row.name, kind: 'admin', role: row.role, authTime: SIGN_IN }
}

function memberUser(row: MemberRow, role: 'supporter' | 'sponsor' = row.role): AuthorizedUser {
  return { id: String(row.id), email: row.email, name: row.name, kind: 'member', role, authTime: SIGN_IN }
}

function adminGuards() {
  return [
    ['currentAdmin', () => currentAdmin()],
    ['requireAdmin', () => requireAdmin()],
    ['requireMaster', () => requireMaster()],
    ['requireAccountCreator', () => requireAccountCreator()],
  ] as const
}

async function expectRefusedByEveryAdminGuard() {
  await expect(currentAdmin()).resolves.toBeNull()
  await expect(requireAdmin()).rejects.toThrow('REDIRECT /login')
  await expect(requireMaster()).rejects.toThrow('REDIRECT /login')
  await expect(requireAccountCreator()).rejects.toThrow('REDIRECT /login')
}

beforeEach(() => {
  fake.state.admins = []
  fake.state.members = []
  fake.state.counts = { emailAttempts: 1, ipAttempts: 1 }
  fake.state.ops = []
  fake.auth.mockReset()
  fake.getDb.mockClear()
  fake.redirect.mockClear()
  fake.compare.mockReset()
  fake.compare.mockResolvedValue(false)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('a member session against the admin guards', () => {
  it('passes the member guard, as a baseline for the refusals below', async () => {
    fake.state.members = [mia]
    await signedInAs(memberUser(mia))
    await expect(requireMember()).resolves.toMatchObject({ user: { id: '7', kind: 'member', name: 'Mia' } })
  })

  it('is refused by every admin guard without reading the admins table', async () => {
    fake.state.members = [mia]
    fake.state.admins = [max]
    await signedInAs(memberUser(mia))
    await expectRefusedByEveryAdminGuard()
    expect(fake.state.ops.filter((op) => op === 'select admins')).toEqual([])
  })

  it('is refused when its id and email exactly match an existing master row', async () => {
    const twin: MemberRow = { ...mia, id: max.id, email: max.email }
    fake.state.members = [twin]
    fake.state.admins = [max]
    await signedInAs(memberUser(twin))
    await expectRefusedByEveryAdminGuard()
    expect(fake.state.ops.filter((op) => op === 'select admins')).toEqual([])
  })

  it('is refused even when the token claims the master role', async () => {
    const twin: MemberRow = { ...mia, id: max.id, email: max.email }
    fake.state.members = [twin]
    fake.state.admins = [max]
    const token = { ...(await signInToken(memberUser(twin))), role: 'master' as const }
    const session = await readSession(token)
    expect(session.user).toMatchObject({ kind: 'member', role: 'master' })
    fake.auth.mockResolvedValue(session)
    await expectRefusedByEveryAdminGuard()
  })

  it.each(adminGuards())('%s never consults the database for a member token', async (_name, guard) => {
    fake.state.admins = [max]
    await signedInAs(memberUser({ ...mia, id: max.id, email: max.email }))
    await guard().catch(() => {})
    expect(fake.getDb).not.toHaveBeenCalled()
  })
})

describe('an admin session against the member guards', () => {
  it('passes the admin guards, as a baseline for the refusals below', async () => {
    fake.state.admins = [max]
    await signedInAs(adminUser(max))
    await expect(requireMaster()).resolves.toMatchObject({ user: { id: '1', kind: 'admin', role: 'master' } })
  })

  it('is refused by currentMember and requireMember even when a members row has the same id and email', async () => {
    fake.state.admins = [max]
    fake.state.members = [{ ...mia, id: max.id, email: max.email }]
    await signedInAs(adminUser(max))
    await expect(currentMember()).resolves.toBeNull()
    await expect(requireMember()).rejects.toThrow('REDIRECT /login')
    expect(fake.state.ops).not.toContain('select members')
  })

  it('treats a legacy token with no kind as admin-only', async () => {
    fake.state.admins = [max]
    fake.state.members = [{ ...mia, id: max.id, email: max.email }]
    const legacyToken = { name: max.name, email: max.email, sub: String(max.id), role: 'master' as const }
    const session = await readSession(legacyToken)
    expect(session.user).not.toHaveProperty('kind')
    fake.auth.mockResolvedValue(session)

    await expect(currentAdmin()).resolves.toMatchObject({ user: { id: '1', kind: 'admin', role: 'master' } })
    await expect(currentMember()).resolves.toBeNull()
    await expect(requireMember()).rejects.toThrow('REDIRECT /login')
    expect(fake.state.ops).not.toContain('select members')
  })
})

describe('the update trigger', () => {
  it('cannot turn a member token into an admin, a master, or a fresher sign-in', async () => {
    fake.state.admins = [max]
    const twin: MemberRow = { ...mia, id: max.id, email: max.email }
    fake.state.members = [twin]
    const token = await signInToken(memberUser(twin))
    const session = await readSession(token, { kind: 'admin', role: 'master', authTime: SIGN_IN + 3_600_000 })

    expect(session).toMatchObject({ user: { kind: 'member', role: 'supporter' }, authTime: SIGN_IN })
    fake.auth.mockResolvedValue(session)
    await expectRefusedByEveryAdminGuard()
  })

  it('cannot turn an admin token into a member token', async () => {
    const token = await signInToken(adminUser(max))
    const session = await readSession(token, { kind: 'member', role: 'supporter' })
    expect(session).toMatchObject({ user: { kind: 'admin', role: 'master' }, authTime: SIGN_IN })
  })

  it('ignores a user object passed alongside the update trigger', async () => {
    const token = await signInToken(memberUser(mia))
    const updated = await jwtCallback({
      token: { ...token },
      user: { ...adminUser(max), authTime: SIGN_IN + 1 } as User,
      account: null,
      trigger: 'update',
      session: { kind: 'admin' },
    } as JwtParams)
    expect(updated).toEqual(token)
  })

  it('returns the token unchanged when no user is present', async () => {
    const token = await signInToken(memberUser(mia))
    const updated = await jwtCallback({ token: { ...token }, trigger: 'update', session: { role: 'sponsor' } } as JwtParams)
    expect(updated).toEqual(token)
  })
})

describe('currentMember re-checks the members row', () => {
  beforeEach(async () => {
    await signedInAs(memberUser(mia))
  })

  it('refuses a deleted member', async () => {
    fake.state.members = []
    await expect(currentMember()).resolves.toBeNull()
    await expect(requireMember()).rejects.toThrow('REDIRECT /login')
  })

  it('refuses when the id now belongs to an account with a different email', async () => {
    fake.state.members = [{ ...mia, email: 'someone-else@example.com' }]
    await expect(currentMember()).resolves.toBeNull()
  })

  it('refuses an unconfirmed member', async () => {
    fake.state.members = [{ ...mia, emailConfirmedAt: null }]
    await expect(currentMember()).resolves.toBeNull()
  })

  it('refuses a session older than the last password change', async () => {
    fake.state.members = [{ ...mia, passwordChangedAt: new Date(SIGN_IN + 1) }]
    await expect(currentMember()).resolves.toBeNull()
  })

  it('accepts a session signed in at the moment of the password change', async () => {
    fake.state.members = [{ ...mia, passwordChangedAt: new Date(SIGN_IN) }]
    await expect(currentMember()).resolves.toMatchObject({ user: { id: '7' } })
  })

  it('takes the role from the database rather than the token', async () => {
    await signedInAs(memberUser(mia, 'sponsor'))
    fake.state.members = [mia]
    await expect(currentMember()).resolves.toMatchObject({ user: { role: 'supporter' } })
  })
})

describe('authorizeCredentials', () => {
  const credentialsFor = (email: string, password = 'some long password') => ({ email, password })

  function expectOneCompareAndNoClear() {
    expect(fake.compare).toHaveBeenCalledTimes(1)
    expect(fake.state.ops).not.toContain('clear email attempts')
  }

  it('runs exactly one compare for an unknown email, against a well-formed cost-12 hash', async () => {
    await expect(authorizeCredentials(credentialsFor('nobody@example.com'), null)).resolves.toBeNull()
    expectOneCompareAndNoClear()

    const realBcrypt = (await vi.importActual<{ default: typeof import('bcryptjs') }>('bcryptjs')).default
    const dummyHash = fake.compare.mock.calls[0][1]
    expect(dummyHash).toHaveLength(60)
    expect(realBcrypt.getRounds(dummyHash)).toBe(12)
  })

  it('runs exactly one compare for an admin with the wrong password', async () => {
    fake.state.admins = [max]
    await expect(authorizeCredentials(credentialsFor(max.email), null)).resolves.toBeNull()
    expectOneCompareAndNoClear()
    expect(fake.compare).toHaveBeenCalledWith('some long password', max.passwordHash)
  })

  it('runs exactly one compare for a member with the wrong password', async () => {
    fake.state.members = [mia]
    await expect(authorizeCredentials(credentialsFor(mia.email), null)).resolves.toBeNull()
    expectOneCompareAndNoClear()
  })

  it('runs exactly one compare and refuses an unconfirmed member with the correct password', async () => {
    fake.state.members = [{ ...mia, emailConfirmedAt: null }]
    fake.compare.mockResolvedValue(true)
    await expect(authorizeCredentials(credentialsFor(mia.email), null)).resolves.toBeNull()
    expectOneCompareAndNoClear()
  })

  it('runs exactly one compare for a successful admin sign-in and returns an admin', async () => {
    fake.state.admins = [max]
    fake.compare.mockResolvedValue(true)
    await expect(authorizeCredentials(credentialsFor('MAX@example.com'), null)).resolves.toMatchObject({
      id: '1',
      kind: 'admin',
      role: 'master',
    })
    expect(fake.compare).toHaveBeenCalledTimes(1)
  })

  it('never reaches bcrypt or the account tables once throttled', async () => {
    fake.state.admins = [max]
    fake.state.members = [mia]
    fake.compare.mockResolvedValue(true)
    for (const counts of [
      { emailAttempts: 6, ipAttempts: 1 },
      { emailAttempts: 1, ipAttempts: 21 },
    ]) {
      fake.state.counts = counts
      for (const email of [max.email, mia.email, 'nobody@example.com']) {
        await expect(authorizeCredentials(credentialsFor(email), '203.0.113.7')).resolves.toBeNull()
      }
    }
    expect(fake.compare).not.toHaveBeenCalled()
    expect(fake.state.ops.filter((op) => op.startsWith('select '))).toEqual([])
  })

  describe('an email present in both tables', () => {
    const shared = 'both@example.com'
    const bothAdmin: AdminRow = { ...max, id: 3, email: shared, role: 'admin', passwordHash: '$2b$12$admin-side' }
    const bothMember: MemberRow = { ...mia, id: 3, email: shared, passwordHash: '$2b$12$member-side' }

    beforeEach(() => {
      fake.state.admins = [bothAdmin]
      fake.state.members = [bothMember]
    })

    it('signs in as the admin with the admin password, never checking the member password', async () => {
      fake.compare.mockImplementation(async (_password, hash) => hash === bothAdmin.passwordHash)
      await expect(authorizeCredentials(credentialsFor(shared), null)).resolves.toMatchObject({
        id: '3',
        kind: 'admin',
        role: 'admin',
      })
      expect(fake.compare).toHaveBeenCalledTimes(1)
      expect(fake.compare).toHaveBeenCalledWith('some long password', bothAdmin.passwordHash)
    })

    it('refuses the member password, so the member account cannot be signed into while the admin exists', async () => {
      fake.compare.mockImplementation(async (_password, hash) => hash === bothMember.passwordHash)
      await expect(authorizeCredentials(credentialsFor(shared), null)).resolves.toBeNull()
      expect(fake.compare).toHaveBeenCalledTimes(1)
      expect(fake.compare).toHaveBeenCalledWith('some long password', bothAdmin.passwordHash)
    })
  })
})
