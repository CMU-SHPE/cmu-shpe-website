import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

const mocks = vi.hoisted(() => {
  const state = {
    resetRows: [{ email: 'ada@example.org', name: 'Ada' }] as { email: string; name: string }[],
    ops: [] as string[],
    statements: [] as SQL[],
  }
  return {
    state,
    find: vi.fn<(token: string) => Promise<number | null>>(),
    findMember: vi.fn(),
    db: {
      execute: async (statement: SQL) => {
        state.ops.push('reset')
        state.statements.push(statement)
        return { rows: state.resetRows }
      },
    },
    hash: vi.fn(async () => {
      mocks.state.ops.push('hash')
      return '$2b$12$new'
    }),
    sendEmail: vi.fn<(message: { to: string; subject: string; text: string }) => Promise<void>>(async () => {
      mocks.state.ops.push('send')
    }),
    redirect: vi.fn((url: string) => {
      throw new Error(`REDIRECT ${url}`)
    }),
  }
})

vi.mock('@/db', () => ({ getDb: () => mocks.db }))
vi.mock('@/lib/admin-tokens', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/admin-tokens')>()),
  findAdminResetToken: mocks.find,
}))
vi.mock('@/lib/member-tokens', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/member-tokens')>()),
  findMemberToken: mocks.findMember,
}))
vi.mock('@/lib/email', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email')>()),
  sendEmail: mocks.sendEmail,
}))
vi.mock('bcryptjs', () => ({ default: { hash: mocks.hash } }))
vi.mock('@/lib/site-url', () => ({ siteUrl: () => 'https://shpe.test' }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))

import { EmailSendError } from '@/lib/email'
import { hashToken } from '@/lib/member-tokens'
import { resetAdminPasswordWithLink } from './actions'

const TOKEN = 'B'.repeat(43)
const PASSWORD = 'a brand new admin passphrase'

function form(overrides: Record<string, string> = {}) {
  const formData = new FormData()
  for (const [name, value] of Object.entries({ token: TOKEN, password: PASSWORD, confirmPassword: PASSWORD, ...overrides })) {
    formData.set(name, value)
  }
  return formData
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.state.resetRows = [{ email: 'ada@example.org', name: 'Ada' }]
  mocks.state.ops = []
  mocks.state.statements = []
  mocks.find.mockResolvedValue(1)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

const normalized = (statement: SQL) => {
  const { sql: text, params } = new PgDialect().sqlToQuery(statement)
  return { text: text.replace(/\s+/g, ' ').trim(), params }
}

describe('resetAdminPasswordWithLink', () => {
  it('uses up an admin link and sets the hash in one statement, ending sessions and the lockout, then notifies', async () => {
    const before = Date.now()
    await expect(resetAdminPasswordWithLink({}, form())).rejects.toThrow('REDIRECT /login?reset=1')
    expect(mocks.find).toHaveBeenCalledWith(TOKEN)
    expect(mocks.findMember).not.toHaveBeenCalled()
    expect(mocks.hash).toHaveBeenCalledWith(PASSWORD, 12)
    expect(mocks.state.ops).toEqual(['hash', 'reset', 'send'])

    const { text, params } = normalized(mocks.state.statements[0])
    expect(text).toMatch(
      /^with consumed as \( delete from admin_tokens where token_hash = \$1 and expires_at > now\(\) returning admin_id \), updated as \( update admins a set password_hash = \$2, password_changed_at = \$3::timestamptz from consumed where a\.id = consumed\.admin_id returning/,
    )
    expect(text).not.toContain('member_tokens')
    expect(text).not.toMatch(/\brole\b/)
    expect(text).toContain('delete from admin_tokens t using updated where t.admin_id = updated.id and t.token_hash <> $4')
    expect(text).toContain('delete from login_attempts l using updated where l.email = updated.email')
    expect(params[0]).toBe(hashToken(TOKEN))
    expect(params[1]).toBe('$2b$12$new')
    expect(new Date(params[2] as string).getTime()).toBeGreaterThanOrEqual(before)

    expect(mocks.sendEmail.mock.calls[0][0]).toMatchObject({
      to: 'ada@example.org',
      subject: 'Your SHPE @ CMU password was changed',
    })
  })

  it('applies the password policy before looking up or using the link', async () => {
    const result = await resetAdminPasswordWithLink({}, form({ password: 'short', confirmPassword: 'short' }))
    expect(result.errors).toMatchObject({ password: expect.any(String) })
    const mismatch = await resetAdminPasswordWithLink({}, form({ confirmPassword: 'something different' }))
    expect(mismatch.errors).toMatchObject({ confirmPassword: expect.any(String) })
    expect(mocks.find).not.toHaveBeenCalled()
    expect(mocks.state.statements).toEqual([])
  })

  it('refuses a link that is not in admin_tokens, such as a member link, without hashing or writing', async () => {
    mocks.find.mockResolvedValue(null)
    mocks.findMember.mockResolvedValue(7)
    await expect(resetAdminPasswordWithLink({}, form())).resolves.toEqual({ formError: expect.stringContaining('expired') })
    expect(mocks.hash).not.toHaveBeenCalled()
    expect(mocks.state.statements).toEqual([])
  })

  it('refuses the link and sends no notice when it was used up between the lookup and the write', async () => {
    mocks.state.resetRows = []
    await expect(resetAdminPasswordWithLink({}, form())).resolves.toEqual({ formError: expect.stringContaining('expired') })
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it('refuses a malformed token without touching the database', async () => {
    await expect(resetAdminPasswordWithLink({}, form({ token: 'nope' }))).resolves.toEqual({
      formError: expect.stringContaining('expired'),
    })
    expect(mocks.find).not.toHaveBeenCalled()
  })

  it('still finishes the reset when the notice email fails, logging it', async () => {
    mocks.sendEmail.mockRejectedValueOnce(new EmailSendError('validation_error'))
    await expect(resetAdminPasswordWithLink({}, form())).rejects.toThrow('REDIRECT /login?reset=1')
    expect(console.error).toHaveBeenCalledWith('EMAIL SEND FAILED: password_changed')
  })
})
