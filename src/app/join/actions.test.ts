import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

type Write = { kind: 'insert' | 'update' | 'delete'; table: string; values?: Record<string, unknown>; where?: SQL }

const mocks = vi.hoisted(() => {
  const state = {
    admin: null as { name: string } | null,
    member: null as { id: number; name: string; emailConfirmedAt: Date | null } | null,
    ops: [] as string[],
    batches: [] as Write[][],
    batchError: null as null | (() => unknown),
    throttled: false,
  }
  const tableName = (table: unknown) => (table as Record<symbol, string>)[Symbol.for('drizzle:Name')]
  const db = {
    select: () => {
      let table = ''
      const query = {
        from: (source: unknown) => {
          table = tableName(source)
          return query
        },
        where: () => query,
        limit: async () => {
          state.ops.push(`find ${table}`)
          if (table === 'admins') return state.admin ? [state.admin] : []
          return state.member ? [state.member] : []
        },
      }
      return query
    },
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => ({ kind: 'insert', table: tableName(table), values }),
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: (where: SQL) => ({ kind: 'update', table: tableName(table), values, where }),
      }),
    }),
    delete: (table: unknown) => ({
      where: (where: SQL) => ({
        kind: 'delete',
        table: tableName(table),
        where,
        then: (resolve: (value: unknown) => void) => {
          state.ops.push(`purge ${tableName(table)}`)
          resolve(undefined)
        },
      }),
    }),
    batch: async (writes: Write[]) => {
      state.ops.push('batch')
      if (state.batchError) {
        const error = state.batchError()
        state.batchError = null
        throw error
      }
      state.batches.push(writes)
    },
  }
  return {
    state,
    db,
    sendEmail: vi.fn(async (message: { to: string; subject: string; text: string }) => {
      state.ops.push(`send ${message.subject}`)
    }),
    hash: vi.fn(async () => {
      state.ops.push('hash')
      return '$2b$12$hashed'
    }),
    recordRequest: vi.fn(async () => {
      state.ops.push('record request')
      return { throttled: state.throttled }
    }),
    siteUrl: vi.fn(() => 'https://shpe.test'),
    redirect: vi.fn((url: string) => {
      throw new Error(`REDIRECT ${url}`)
    }),
  }
})

vi.mock('@/db', () => ({ getDb: () => mocks.db }))
vi.mock('@/lib/email', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email')>()),
  sendEmail: mocks.sendEmail,
}))
vi.mock('bcryptjs', () => ({ default: { hash: mocks.hash } }))
vi.mock('@/lib/request-throttle', () => ({ recordRequest: mocks.recordRequest }))
vi.mock('@/lib/site-url', () => ({ siteUrl: mocks.siteUrl }))
vi.mock('@/lib/queries', () => ({ getPrivacyPolicyVersion: async () => 'October 2026' }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.7' }) }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))

import { EmailSendError } from '@/lib/email'
import { SEND_FAILED_MESSAGE } from '@/lib/member-accounts'
import { signUp } from './actions'

const PASSWORD = 'correct horse battery'

function form(overrides: Record<string, string | undefined> = {}) {
  const values: Record<string, string | undefined> = {
    name: 'New Name',
    email: 'Mia@Example.com',
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

const branches = {
  new: () => {},
  unconfirmed: () => {
    mocks.state.member = { id: 7, name: 'Stored Name', emailConfirmedAt: null }
  },
  confirmed: () => {
    mocks.state.member = { id: 7, name: 'Stored Name', emailConfirmedAt: new Date('2026-10-01') }
  },
  admin: () => {
    mocks.state.admin = { name: 'Stored Admin' }
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(mocks.state, { admin: null, member: null, ops: [], batches: [], batchError: null, throttled: false })
  mocks.siteUrl.mockImplementation(() => 'https://shpe.test')
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

const render = (where: SQL) => new PgDialect().sqlToQuery(where)
const sentText = () => (mocks.sendEmail.mock.calls[0][0] as { text: string }).text

describe('signUp outcomes look identical from outside', () => {
  it.each(Object.keys(branches))('%s: hashes once at cost 12, sends exactly one email, shows the inbox page', async (branch) => {
    branches[branch as keyof typeof branches]()
    await expect(signUp({}, form())).rejects.toThrow('REDIRECT /join/check-email')
    expect(mocks.hash).toHaveBeenCalledTimes(1)
    expect(mocks.hash).toHaveBeenCalledWith(PASSWORD, 12)
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
    expect(mocks.sendEmail.mock.calls[0][0]).toMatchObject({ to: 'mia@example.com' })
  })

  it.each(Object.keys(branches))('%s: a failed send shows the same message and keeps no password', async (branch) => {
    branches[branch as keyof typeof branches]()
    mocks.sendEmail.mockRejectedValueOnce(new EmailSendError('validation_error'))
    await expect(signUp({}, form())).resolves.toEqual({
      formError: SEND_FAILED_MESSAGE,
      values: { name: 'New Name', email: 'Mia@Example.com', ageConfirmed: 'on', termsAccepted: 'on' },
    })
  })

  it('resolves the site URL before anything that depends on the account', async () => {
    mocks.siteUrl.mockImplementation(() => {
      throw new Error('SITE_URL is not set')
    })
    await expect(signUp({}, form())).rejects.toThrow('SITE_URL is not set')
    expect(mocks.state.ops).toEqual([])
  })
})

describe('signUp branches', () => {
  it('creates a new member and their confirmation token in one batch', async () => {
    await expect(signUp({}, form())).rejects.toThrow('REDIRECT')
    const [batch] = mocks.state.batches
    expect(batch.map((write) => `${write.kind} ${write.table}`)).toEqual(['insert members', 'insert member_tokens'])
    expect(batch[0].values).toMatchObject({
      email: 'mia@example.com',
      name: 'New Name',
      passwordHash: '$2b$12$hashed',
      privacyPolicyVersion: 'October 2026',
      ageConfirmedAt: expect.any(Date),
      termsAcceptedAt: expect.any(Date),
    })
    expect(batch[1].values).toMatchObject({ purpose: 'confirm_email', tokenHash: expect.stringMatching(/^[0-9a-f]{64}$/) })
    expect(mocks.sendEmail.mock.calls[0][0]).toMatchObject({ subject: 'Confirm your email for SHPE @ CMU' })
    expect(sentText()).toMatch(/https:\/\/shpe\.test\/join\/confirm\?token=[A-Za-z0-9_-]{43}\n/)
    expect(sentText()).toContain('Hi New Name,')
  })

  it('takes over an unconfirmed account: new details, old links revoked, fresh link sent', async () => {
    branches.unconfirmed()
    await expect(signUp({}, form())).rejects.toThrow('REDIRECT')
    const [batch] = mocks.state.batches
    expect(batch.map((write) => `${write.kind} ${write.table}`)).toEqual([
      'update members',
      'delete member_tokens',
      'insert member_tokens',
    ])
    expect(batch[0].values).toMatchObject({ name: 'New Name', passwordHash: '$2b$12$hashed', privacyPolicyVersion: 'October 2026' })
    expect(render(batch[1].where!).params).toEqual([7, 'confirm_email'])
    expect(batch[2].values).toMatchObject({ memberId: 7, purpose: 'confirm_email' })
    expect(sentText()).toContain('/join/confirm?token=')
  })

  it('leaves a confirmed account alone and emails its owner by their stored name', async () => {
    branches.confirmed()
    await expect(signUp({}, form())).rejects.toThrow('REDIRECT')
    expect(mocks.state.batches).toEqual([])
    expect(mocks.sendEmail.mock.calls[0][0]).toMatchObject({ subject: 'Someone tried to create an account with your email' })
    expect(sentText()).toContain('Hi Stored Name,')
    expect(sentText()).toContain('https://shpe.test/forgot-password')
  })

  it('leaves an admin alone and sends the admin version, without a reset link', async () => {
    branches.admin()
    await expect(signUp({}, form())).rejects.toThrow('REDIRECT')
    expect(mocks.state.ops.filter((op) => op.startsWith('find')).sort()).toEqual(['find admins', 'find members'])
    expect(mocks.state.batches).toEqual([])
    expect(sentText()).toContain('Hi Stored Admin,')
    expect(sentText()).toContain('master admin')
    expect(sentText()).not.toContain('forgot-password')
  })

  it('purges stale unconfirmed accounts before looking the email up', async () => {
    await expect(signUp({}, form())).rejects.toThrow('REDIRECT')
    expect(mocks.state.ops.slice(0, 3)).toEqual(['record request', 'hash', 'purge members'])
    expect(mocks.state.ops.slice(3, 5).sort()).toEqual(['find admins', 'find members'])
  })

  it('treats losing a simultaneous sign-up race as arriving second, still sending one email', async () => {
    mocks.state.batchError = () => {
      mocks.state.member = { id: 9, name: 'Racer', emailConfirmedAt: null }
      return Object.assign(new Error('duplicate key'), { code: '23505' })
    }
    await expect(signUp({}, form())).rejects.toThrow('REDIRECT /join/check-email')
    expect(mocks.state.batches[0].map((write) => `${write.kind} ${write.table}`)).toEqual([
      'update members',
      'delete member_tokens',
      'insert member_tokens',
    ])
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
  })
})

describe('signUp refusals', () => {
  it('gives a throttled request the same page without hashing, looking up or emailing', async () => {
    mocks.state.throttled = true
    await expect(signUp({}, form())).rejects.toThrow('REDIRECT /join/check-email')
    expect(mocks.state.ops).toEqual(['record request'])
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it('returns field errors without recording or sending anything', async () => {
    const result = await signUp({}, form({ ageConfirmed: undefined, name: 'Two\nLines' }))
    expect(result.errors).toMatchObject({ ageConfirmed: expect.any(String), name: expect.any(String) })
    expect(result.values).not.toHaveProperty('password')
    expect(mocks.recordRequest).not.toHaveBeenCalled()
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })
})
