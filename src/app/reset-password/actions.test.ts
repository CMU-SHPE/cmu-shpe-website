import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

type Write = { kind: string; table: string; values?: Record<string, unknown>; where?: SQL }

const mocks = vi.hoisted(() => {
  const state = {
    member: { email: 'mia@example.com', name: 'Mia' } as { email: string; name: string } | null,
    ops: [] as string[],
    batches: [] as Write[][],
  }
  const tableName = (table: unknown) => (table as Record<symbol, string>)[Symbol.for('drizzle:Name')]
  return {
    state,
    consume: vi.fn<(token: string, purpose: string) => Promise<number | null>>(),
    db: {
      select: () => {
        const query = {
          from: () => query,
          where: () => query,
          limit: async () => (state.member ? [state.member] : []),
        }
        return query
      },
      update: (table: unknown) => ({
        set: (values: Record<string, unknown>) => ({
          where: (where: SQL) => ({ kind: 'update', table: tableName(table), values, where }),
        }),
      }),
      delete: (table: unknown) => ({ where: (where: SQL) => ({ kind: 'delete', table: tableName(table), where }) }),
      batch: async (writes: Write[]) => {
        state.ops.push('batch')
        state.batches.push(writes)
      },
    },
    hash: vi.fn(async () => '$2b$12$new'),
    sendEmail: vi.fn<(message: { to: string; subject: string; text: string }) => Promise<void>>(async () => {
      mocks.state.ops.push('send')
    }),
    redirect: vi.fn((url: string) => {
      throw new Error(`REDIRECT ${url}`)
    }),
  }
})

vi.mock('@/db', () => ({ getDb: () => mocks.db }))
vi.mock('@/lib/member-tokens', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/member-tokens')>()),
  consumeMemberToken: mocks.consume,
}))
vi.mock('@/lib/email', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email')>()),
  sendEmail: mocks.sendEmail,
}))
vi.mock('bcryptjs', () => ({ default: { hash: mocks.hash } }))
vi.mock('@/lib/site-url', () => ({ siteUrl: () => 'https://shpe.test' }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))

import { EmailSendError } from '@/lib/email'
import { resetMemberPassword } from './actions'

const TOKEN = 'A'.repeat(43)
const PASSWORD = 'a brand new passphrase'

function form(overrides: Record<string, string> = {}) {
  const formData = new FormData()
  for (const [name, value] of Object.entries({ token: TOKEN, password: PASSWORD, confirmPassword: PASSWORD, ...overrides })) {
    formData.set(name, value)
  }
  return formData
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.state.member = { email: 'mia@example.com', name: 'Mia' }
  mocks.state.ops = []
  mocks.state.batches = []
  mocks.consume.mockResolvedValue(7)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('resetMemberPassword', () => {
  it('sets the new hash and password_changed_at, revokes reset links, clears login attempts, then notifies', async () => {
    const before = Date.now()
    await expect(resetMemberPassword({}, form())).rejects.toThrow('REDIRECT /login?reset=1')
    expect(mocks.consume).toHaveBeenCalledWith(TOKEN, 'reset_password')
    expect(mocks.hash).toHaveBeenCalledWith(PASSWORD, 12)

    const [[update, revoke, clearAttempts]] = mocks.state.batches
    expect(update).toMatchObject({ kind: 'update', table: 'members', values: { passwordHash: '$2b$12$new' } })
    expect((update.values!.passwordChangedAt as Date).getTime()).toBeGreaterThanOrEqual(before)
    expect(new PgDialect().sqlToQuery(update.where!).params).toEqual([7])
    expect(revoke.table).toBe('member_tokens')
    expect(new PgDialect().sqlToQuery(revoke.where!).params).toEqual([7, 'reset_password'])
    expect(clearAttempts.table).toBe('login_attempts')
    expect(new PgDialect().sqlToQuery(clearAttempts.where!).params).toEqual(['mia@example.com'])

    expect(mocks.state.ops).toEqual(['batch', 'send'])
    expect(mocks.sendEmail.mock.calls[0][0]).toMatchObject({
      to: 'mia@example.com',
      subject: 'Your SHPE @ CMU password was changed',
    })
    expect(mocks.sendEmail.mock.calls[0][0].text).toContain('https://shpe.test/contact')
  })

  it('checks the new password before using up the link', async () => {
    const result = await resetMemberPassword({}, form({ password: 'short', confirmPassword: 'short' }))
    expect(result.errors).toMatchObject({ password: expect.any(String) })
    await resetMemberPassword({}, form({ confirmPassword: 'something different' }))
    expect(mocks.consume).not.toHaveBeenCalled()
  })

  it('refuses a used or expired link without writing anything', async () => {
    mocks.consume.mockResolvedValue(null)
    await expect(resetMemberPassword({}, form())).resolves.toEqual({ formError: expect.stringContaining('expired') })
    expect(mocks.hash).not.toHaveBeenCalled()
    expect(mocks.state.batches).toEqual([])
  })

  it('refuses a malformed token without touching the database', async () => {
    await expect(resetMemberPassword({}, form({ token: 'nope' }))).resolves.toEqual({
      formError: expect.stringContaining('expired'),
    })
    expect(mocks.consume).not.toHaveBeenCalled()
  })

  it('still finishes the reset when the notice email fails, logging it', async () => {
    mocks.sendEmail.mockRejectedValueOnce(new EmailSendError('validation_error'))
    await expect(resetMemberPassword({}, form())).rejects.toThrow('REDIRECT /login?reset=1')
    expect(console.error).toHaveBeenCalledWith('EMAIL SEND FAILED: password_changed')
  })
})
