import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import type { EmailMessage } from '@/lib/email'

type MemberRow = {
  id: number
  email: string
  name: string
  passwordHash: string
  emailConfirmedAt: Date | null
}
type TokenRow = { memberId: number; purpose: string; tokenHash: string; expiresAt: Date }
type ThrottleRow = { action: string; email: string; ip: string | null; createdAt: Date }
type Write = () => void

const fake = vi.hoisted(() => {
  const state = {
    admins: [] as { email: string; name: string }[],
    members: [] as MemberRow[],
    tokens: [] as TokenRow[],
    throttle: [] as ThrottleRow[],
    nextMemberId: 1,
    hashes: 0,
    accountLookups: 0,
  }
  return {
    state,
    getDb: vi.fn(),
    sendEmail: vi.fn<(message: EmailMessage) => Promise<void>>(async () => {}),
    hash: vi.fn(async (password: string, cost: number) => {
      state.hashes += 1
      return `$2b$${cost}$hash-of:${password}`
    }),
    headers: vi.fn(
      async () =>
        new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1', host: 'evil.example', 'x-forwarded-host': 'evil.example' }),
    ),
    redirect: vi.fn((url: string) => {
      throw new Error(`REDIRECT ${url}`)
    }),
  }
})

vi.mock('@/db', () => ({ getDb: fake.getDb }))
vi.mock('@/lib/email', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email')>()),
  sendEmail: fake.sendEmail,
}))
vi.mock('bcryptjs', () => ({ default: { hash: fake.hash } }))
vi.mock('@/lib/queries', () => ({ getPrivacyPolicyVersion: async () => 'October 2026' }))
vi.mock('next/headers', () => ({ headers: fake.headers }))
vi.mock('next/navigation', () => ({ redirect: fake.redirect }))

import { members, memberTokens, requestThrottle } from '@/db/schema'
import { hashToken, newMemberToken } from '@/lib/member-tokens'
import { recordRequest } from '@/lib/request-throttle'
import { confirmMemberEmail } from './confirm/actions'
import { signUp } from './actions'

const dialect = new PgDialect()
const params = (condition: SQL) => dialect.sqlToQuery(condition).params
const sqlText = (condition: SQL) => dialect.sqlToQuery(condition).sql
const tableName = (table: unknown) => (table as Record<symbol, string>)[Symbol.for('drizzle:Name')]
const asDate = (value: unknown) => (value instanceof Date ? value : new Date(String(value).replace(' ', 'T')))

/**
 * Applies writes the way Postgres would for the handful of statements these flows issue,
 * reading the bound parameters out of the rendered SQL rather than trusting call order.
 */
function createDb() {
  const { state } = fake
  const resolveMemberId = (value: unknown) => {
    if (typeof value === 'number') return value
    const [email] = params(value as SQL)
    const member = state.members.find((row) => row.email === email)
    if (!member) throw new Error('token inserted for a member that does not exist')
    return member.id
  }

  const insert = (table: unknown) => ({
    values: (values: Record<string, unknown>) => {
      const apply: Write = () => {
        const name = tableName(table)
        if (name === 'members') {
          if (state.members.some((row) => row.email === values.email)) throw new Error('duplicate key value')
          state.members.push({
            id: state.nextMemberId++,
            email: values.email as string,
            name: values.name as string,
            passwordHash: values.passwordHash as string,
            emailConfirmedAt: null,
          })
        } else if (name === 'member_tokens') {
          state.tokens.push({
            memberId: resolveMemberId(values.memberId),
            purpose: values.purpose as string,
            tokenHash: values.tokenHash as string,
            expiresAt: values.expiresAt as Date,
          })
        } else if (name === 'request_throttle') {
          state.throttle.push({
            action: values.action as string,
            email: values.email as string,
            ip: (values.ip as string | null) ?? null,
            createdAt: new Date(),
          })
        } else {
          throw new Error(`unexpected insert into ${name}`)
        }
      }
      return Object.assign(apply, { then: (resolve: (value: unknown) => void) => resolve(apply()) })
    },
  })

  const update = (table: unknown) => ({
    set: (values: Partial<MemberRow>) => ({
      where: (condition: SQL): Write => () => {
        if (tableName(table) !== 'members') throw new Error('unexpected update')
        const [id] = params(condition)
        const onlyUnconfirmed = /"email_confirmed_at" is null/.test(sqlText(condition))
        for (const row of state.members) {
          if (row.id === id && (!onlyUnconfirmed || row.emailConfirmedAt === null)) Object.assign(row, values)
        }
      },
    }),
  })

  const remove = (table: unknown) => ({
    where: (condition: SQL) => {
      const name = tableName(table)
      const apply = () => {
        if (name === 'member_tokens') {
          const [memberId, purpose] = params(condition)
          state.tokens = state.tokens.filter((row) => !(row.memberId === memberId && row.purpose === purpose))
        } else if (name === 'request_throttle') {
          const [before] = params(condition)
          state.throttle = state.throttle.filter((row) => row.createdAt >= asDate(before))
        } else if (name !== 'members') {
          throw new Error(`unexpected delete from ${name}`)
        }
      }
      return Object.assign(apply, {
        then: (resolve: (value: unknown) => void) => resolve(apply()),
        returning: async () => {
          if (name !== 'member_tokens') throw new Error('unexpected returning')
          const [tokenHash, purpose] = params(condition)
          const now = Date.now()
          const match = state.tokens.find(
            (row) => row.tokenHash === tokenHash && row.purpose === purpose && row.expiresAt.getTime() > now,
          )
          if (!match) return []
          state.tokens = state.tokens.filter((row) => row !== match)
          return [{ memberId: match.memberId }]
        },
      })
    },
  })

  const select = (fields: Record<string, unknown>) => {
    let table = ''
    const query = {
      from: (source: unknown) => {
        table = tableName(source)
        return query
      },
      where: (condition: SQL) => {
        if (table === 'request_throttle') {
          const [key] = Object.keys(fields)
          const [action, value, since] = params(condition)
          const column = key === 'emailRequests' ? 'email' : 'ip'
          const total = state.throttle.filter(
            (row) => row.action === action && row[column] === value && row.createdAt >= asDate(since),
          ).length
          return Promise.resolve([{ [key]: total }])
        }
        const [email] = params(condition)
        return {
          limit: async () => {
            state.accountLookups += 1
            if (table === 'admins') return state.admins.filter((row) => row.email === email)
            return state.members.filter((row) => row.email === email)
          },
        }
      },
    }
    return query
  }

  return {
    insert,
    update,
    delete: remove,
    select,
    batch: async (writes: Write[]) => {
      const snapshot = structuredClone({ members: fake.state.members, tokens: fake.state.tokens })
      try {
        for (const write of writes) write()
      } catch (error) {
        Object.assign(fake.state, snapshot)
        throw error
      }
    },
  }
}

const PASSWORD = 'correct horse battery'
const SIGN_UP_TIME = new Date('2026-10-24T18:00:00.000Z')
const DAY_MS = 24 * 60 * 60 * 1000

function signUpForm(overrides: Record<string, string | undefined> = {}) {
  const values: Record<string, string | undefined> = {
    name: 'Mia Lopez',
    email: 'mia@example.com',
    password: PASSWORD,
    confirmPassword: PASSWORD,
    ageConfirmed: 'on',
    termsAccepted: 'on',
    ...overrides,
  }
  const formData = new FormData()
  for (const [name, value] of Object.entries(values)) if (value !== undefined) formData.set(name, value)
  return formData
}

async function submitSignUp(overrides: Record<string, string | undefined> = {}) {
  return signUp({}, signUpForm(overrides)).then(
    (state) => ({ state }),
    (error: Error) => ({ thrown: error.message }),
  )
}

function lastEmailedToken(): string {
  const { text } = fake.sendEmail.mock.calls.at(-1)![0]
  const match = /https:\/\/shpe\.test\/join\/confirm\?token=([A-Za-z0-9_-]+)/.exec(text)
  if (!match) throw new Error(`no confirmation link in: ${text}`)
  return match[1]
}

async function confirm(token: unknown) {
  const formData = new FormData()
  if (token !== undefined) formData.set('token', token as string | Blob)
  return confirmMemberEmail(formData).then(
    () => 'returned',
    (error: Error) => error.message,
  )
}

beforeEach(() => {
  vi.useFakeTimers({ now: SIGN_UP_TIME, toFake: ['Date'] })
  vi.stubEnv('SITE_URL', 'https://shpe.test')
  vi.clearAllMocks()
  Object.assign(fake.state, {
    admins: [],
    members: [],
    tokens: [],
    throttle: [],
    nextMemberId: 1,
    hashes: 0,
    accountLookups: 0,
  })
  fake.getDb.mockImplementation(createDb)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('the confirmation link a sign-up emails', () => {
  it('carries a token whose sha256 is what was stored, for email confirmation, expiring in 24 hours', async () => {
    await submitSignUp()
    const token = lastEmailedToken()
    expect(fake.state.tokens).toEqual([
      {
        memberId: 1,
        purpose: 'confirm_email',
        tokenHash: hashToken(token),
        expiresAt: new Date(SIGN_UP_TIME.getTime() + DAY_MS),
      },
    ])
    expect(JSON.stringify(fake.state)).not.toContain(token)
  })

  it('is built from SITE_URL, never from the Host or X-Forwarded-Host headers', async () => {
    await submitSignUp()
    const { text, html = '' } = fake.sendEmail.mock.calls[0][0]
    expect(`${text}${html}`).not.toContain('evil.example')
    expect(text).toContain('https://shpe.test/join/confirm?token=')
  })

  it('confirms the account exactly once', async () => {
    await submitSignUp()
    const token = lastEmailedToken()

    await expect(confirm(token)).resolves.toBe('REDIRECT /login?confirmed=1')
    expect(fake.state.members[0].emailConfirmedAt).toEqual(SIGN_UP_TIME)
    expect(fake.state.tokens).toEqual([])

    await expect(confirm(token)).resolves.toBe('REDIRECT /join/confirm?invalid=1')
  })

  it('stops working once 24 hours have passed', async () => {
    await submitSignUp()
    const token = lastEmailedToken()
    vi.setSystemTime(SIGN_UP_TIME.getTime() + DAY_MS)
    await expect(confirm(token)).resolves.toBe('REDIRECT /join/confirm?invalid=1')
    expect(fake.state.members[0].emailConfirmedAt).toBeNull()
  })

  it('still works one millisecond before it expires', async () => {
    await submitSignUp()
    const token = lastEmailedToken()
    vi.setSystemTime(SIGN_UP_TIME.getTime() + DAY_MS - 1)
    await expect(confirm(token)).resolves.toBe('REDIRECT /login?confirmed=1')
  })

  it('is revoked by a later sign-up for the same unconfirmed address, whose own link then works', async () => {
    await submitSignUp()
    const first = lastEmailedToken()
    await submitSignUp({ name: 'Second Try', password: 'another long password', confirmPassword: 'another long password' })
    const second = lastEmailedToken()

    await expect(confirm(first)).resolves.toBe('REDIRECT /join/confirm?invalid=1')
    await expect(confirm(second)).resolves.toBe('REDIRECT /login?confirmed=1')
    expect(fake.state.members).toEqual([
      expect.objectContaining({ id: 1, name: 'Second Try', passwordHash: '$2b$12$hash-of:another long password' }),
    ])
  })

  it('cannot be swapped for a password reset token of the same member', async () => {
    await submitSignUp()
    const { token, row } = newMemberToken(1, 'reset_password')
    fake.state.tokens.push(row as TokenRow)
    await expect(confirm(token)).resolves.toBe('REDIRECT /join/confirm?invalid=1')
    expect(fake.state.members[0].emailConfirmedAt).toBeNull()
    expect(fake.state.tokens.map((stored) => stored.purpose)).toContain('reset_password')
  })

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['one character short', 'a'.repeat(42)],
    ['padded base64', `${'a'.repeat(42)}=`],
    ['a file upload', new Blob(['x'.repeat(43)])],
  ])('refuses a %s token without touching the database', async (_label, token) => {
    await expect(confirm(token)).resolves.toBe('REDIRECT /join/confirm?invalid=1')
    expect(fake.getDb).not.toHaveBeenCalled()
  })

  it('does not re-confirm or change an account that was already confirmed', async () => {
    await submitSignUp()
    const token = lastEmailedToken()
    const earlier = new Date(SIGN_UP_TIME.getTime() - DAY_MS)
    fake.state.members[0].emailConfirmedAt = earlier
    vi.setSystemTime(SIGN_UP_TIME.getTime() + 1000)
    await expect(confirm(token)).resolves.toBe('REDIRECT /login?confirmed=1')
    expect(fake.state.members[0].emailConfirmedAt).toEqual(earlier)
  })
})

describe('sign-up looks the same whoever owns the address', () => {
  const branches: Record<string, () => void> = {
    'a new address': () => {},
    'an unconfirmed member': () => {
      fake.state.members.push({ id: 9, email: 'mia@example.com', name: 'Old', passwordHash: 'x', emailConfirmedAt: null })
      fake.state.nextMemberId = 10
    },
    'a confirmed member': () => {
      fake.state.members.push({
        id: 9,
        email: 'mia@example.com',
        name: 'Old',
        passwordHash: 'x',
        emailConfirmedAt: new Date('2026-10-01'),
      })
    },
    'an admin': () => {
      fake.state.admins.push({ email: 'mia@example.com', name: 'Admin Mia' })
    },
  }

  it.each(Object.keys(branches))('%s: the same redirect, one cost-12 hash and one email to the address', async (branch) => {
    branches[branch]()
    await expect(submitSignUp({ email: '  MIA@Example.COM ' })).resolves.toEqual({ thrown: 'REDIRECT /join/check-email' })
    expect(fake.hash).toHaveBeenCalledTimes(1)
    expect(fake.hash).toHaveBeenCalledWith(PASSWORD, 12)
    expect(fake.sendEmail).toHaveBeenCalledTimes(1)
    expect(fake.sendEmail.mock.calls[0][0].to).toBe('mia@example.com')
  })

  it('never changes a confirmed member or an admin', async () => {
    branches['a confirmed member']()
    branches['an admin']()
    const before = structuredClone(fake.state.members)
    await submitSignUp()
    expect(fake.state.members).toEqual(before)
    expect(fake.state.tokens).toEqual([])
  })

  it('gives a throttled request the same redirect, with no email and no account lookup', async () => {
    branches['a confirmed member']()
    for (let attempt = 0; attempt < 5; attempt += 1) await submitSignUp()
    fake.sendEmail.mockClear()
    const lookupsBefore = fake.state.accountLookups

    await expect(submitSignUp()).resolves.toEqual({ thrown: 'REDIRECT /join/check-email' })
    expect(fake.sendEmail).not.toHaveBeenCalled()
    expect(fake.state.accountLookups).toBe(lookupsBefore)
  })

  it('throttles on the normalised address, so changing its case or padding does not reset the count', async () => {
    const spellings = ['mia@example.com', 'MIA@example.com', ' Mia@Example.com', 'mia@EXAMPLE.COM ', 'Mia@example.com']
    for (const email of spellings) await submitSignUp({ email })
    expect(fake.sendEmail).toHaveBeenCalledTimes(5)
    await submitSignUp({ email: 'MiA@ExAmPlE.cOm' })
    expect(fake.sendEmail).toHaveBeenCalledTimes(5)
    expect(new Set(fake.state.throttle.map((row) => row.email))).toEqual(new Set(['mia@example.com']))
  })

  it('records the first X-Forwarded-For address as the client ip', async () => {
    await submitSignUp()
    expect(fake.state.throttle).toEqual([
      { action: 'signup', email: 'mia@example.com', ip: '203.0.113.7', createdAt: SIGN_UP_TIME },
    ])
  })
})

describe('sign-up refuses bad input before doing anything', () => {
  it.each([
    ['ageConfirmed', 'missing', { ageConfirmed: undefined }],
    ['ageConfirmed', '"true"', { ageConfirmed: 'true' }],
    ['ageConfirmed', '"off"', { ageConfirmed: 'off' }],
    ['ageConfirmed', 'empty', { ageConfirmed: '' }],
    ['termsAccepted', 'missing', { termsAccepted: undefined }],
    ['termsAccepted', '"1"', { termsAccepted: '1' }],
    ['name', 'missing', { name: undefined }],
    ['name', 'blank', { name: '   ' }],
    ['name', 'too long', { name: 'a'.repeat(101) }],
    ['name', 'a line break', { name: 'Mia\nBcc: victim@example.com' }],
    ['name', 'a carriage return', { name: 'Mia\rLopez' }],
    ['name', 'a unicode line separator', { name: 'Mia Lopez' }],
    ['name', 'a control character', { name: 'Mia\u0007' }],
    ['email', 'a header injection', { email: 'mia@example.com\r\nBcc: victim@example.com' }],
    ['email', 'not an address', { email: 'mia' }],
    ['password', 'too short', { password: 'short', confirmPassword: 'short' }],
    ['password', 'over 72 bytes', { password: 'é'.repeat(37), confirmPassword: 'é'.repeat(37) }],
    ['confirmPassword', 'a mismatch', { confirmPassword: 'something else entirely' }],
  ])('%s %s', async (field, _label, overrides) => {
    const outcome = await submitSignUp(overrides)
    expect(outcome).toMatchObject({ state: { errors: { [field]: expect.any(String) } } })
    expect(fake.getDb).not.toHaveBeenCalled()
    expect(fake.hash).not.toHaveBeenCalled()
    expect(fake.sendEmail).not.toHaveBeenCalled()
  })

  it('accepts a 100-character name and exactly 72 bytes of password', async () => {
    const password = 'é'.repeat(36)
    await expect(submitSignUp({ name: 'a'.repeat(100), password, confirmPassword: password })).resolves.toEqual({
      thrown: 'REDIRECT /join/check-email',
    })
  })

  it('never echoes the password back after a failed submit', async () => {
    const outcome = await submitSignUp({ ageConfirmed: undefined })
    expect(JSON.stringify(outcome)).not.toContain(PASSWORD)
  })
})

describe('recordRequest against stored rows', () => {
  const record = (action: 'signup' | 'forgot_password' | 'resend_confirmation', email: string, ip: string | null = null) =>
    recordRequest(action, email, ip).then((result) => result.throttled)

  it('allows 5 requests per address in 15 minutes and refuses the 6th', async () => {
    for (let n = 1; n <= 5; n += 1) await expect(record('signup', 'mia@example.com')).resolves.toBe(false)
    await expect(record('signup', 'mia@example.com')).resolves.toBe(true)
  })

  it('counts each action separately', async () => {
    for (let n = 1; n <= 6; n += 1) await record('signup', 'mia@example.com', '203.0.113.7')
    await expect(record('forgot_password', 'mia@example.com', '203.0.113.7')).resolves.toBe(false)
    await expect(record('resend_confirmation', 'mia@example.com', '203.0.113.7')).resolves.toBe(false)
  })

  it('allows 20 requests per ip across addresses and refuses the 21st', async () => {
    for (let n = 1; n <= 20; n += 1) {
      await expect(record('signup', `person${n}@example.com`, '203.0.113.7')).resolves.toBe(false)
    }
    await expect(record('signup', 'someone-new@example.com', '203.0.113.7')).resolves.toBe(true)
    await expect(record('signup', 'someone-new@example.com', '198.51.100.4')).resolves.toBe(false)
  })

  it('does not lump together requests whose ip is unknown', async () => {
    for (let n = 1; n <= 25; n += 1) {
      await expect(record('signup', `person${n}@example.com`, null)).resolves.toBe(false)
    }
  })

  it('forgets requests older than the window and purges them, whatever their action', async () => {
    for (let n = 1; n <= 6; n += 1) await record('signup', 'mia@example.com')
    await record('forgot_password', 'other@example.com')
    expect(fake.state.throttle).toHaveLength(7)

    vi.setSystemTime(SIGN_UP_TIME.getTime() + 15 * 60 * 1000 + 1)
    await expect(record('signup', 'mia@example.com')).resolves.toBe(false)
    expect(fake.state.throttle).toEqual([
      { action: 'signup', email: 'mia@example.com', ip: null, createdAt: new Date(SIGN_UP_TIME.getTime() + 15 * 60 * 1000 + 1) },
    ])
  })

  it('still counts a request made exactly 15 minutes ago', async () => {
    for (let n = 1; n <= 5; n += 1) await record('signup', 'mia@example.com')
    vi.setSystemTime(SIGN_UP_TIME.getTime() + 15 * 60 * 1000)
    await expect(record('signup', 'mia@example.com')).resolves.toBe(true)
  })
})

describe('the fake database used above', () => {
  it('reads the same columns the product code filters on', () => {
    expect(tableName(members)).toBe('members')
    expect(tableName(memberTokens)).toBe('member_tokens')
    expect(tableName(requestThrottle)).toBe('request_throttle')
  })
})
