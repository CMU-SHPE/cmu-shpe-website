import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

const mocks = vi.hoisted(() => {
  const state = {
    resetRows: [{ email: 'mia@example.com', name: 'Mia' }] as { email: string; name: string }[],
    ops: [] as string[],
    statements: [] as SQL[],
  }
  return {
    state,
    find: vi.fn<(token: string, purpose: string) => Promise<number | null>>(),
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
vi.mock('@/lib/member-tokens', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/member-tokens')>()),
  findMemberToken: mocks.find,
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
  mocks.state.resetRows = [{ email: 'mia@example.com', name: 'Mia' }]
  mocks.state.ops = []
  mocks.state.statements = []
  mocks.find.mockResolvedValue(7)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

const normalized = (statement: SQL) => {
  const { sql: text, params } = new PgDialect().sqlToQuery(statement)
  return { text: text.replace(/\s+/g, ' ').trim(), params }
}

describe('resetMemberPassword', () => {
  it('uses up the link and sets the new hash in one statement, revoking other reset links and clearing login attempts, then notifies', async () => {
    const before = Date.now()
    await expect(resetMemberPassword({}, form())).rejects.toThrow('REDIRECT /login?reset=1')
    expect(mocks.find).toHaveBeenCalledWith(TOKEN, 'reset_password')
    expect(mocks.hash).toHaveBeenCalledWith(PASSWORD, 12)
    expect(mocks.state.ops).toEqual(['hash', 'reset', 'send'])

    const [statement] = mocks.state.statements
    const { text, params } = normalized(statement)
    expect(text).toMatch(
      /^with consumed as \( delete from member_tokens where token_hash = \$1 and purpose = 'reset_password' and expires_at > now\(\) returning member_id \), updated as \( update members m set password_hash = \$2, password_changed_at = \$3::timestamptz from consumed where m\.id = consumed\.member_id returning/,
    )
    expect(text).toContain("delete from member_tokens t using updated where t.member_id = updated.id and t.purpose = 'reset_password' and t.token_hash <> $4")
    expect(text).toContain('delete from login_attempts l using updated where l.email = updated.email')
    expect(text).toMatch(/select email, name from updated$/)
    expect(params[0]).toBe(hashToken(TOKEN))
    expect(params[1]).toBe('$2b$12$new')
    expect(new Date(params[2] as string).getTime()).toBeGreaterThanOrEqual(before)
    expect(params[3]).toBe(hashToken(TOKEN))

    expect(mocks.sendEmail.mock.calls[0][0]).toMatchObject({
      to: 'mia@example.com',
      subject: 'Your SHPE @ CMU password was changed',
    })
    expect(mocks.sendEmail.mock.calls[0][0].text).toContain('https://shpe.test/contact')
  })

  it('checks the new password before looking up or using the link', async () => {
    const result = await resetMemberPassword({}, form({ password: 'short', confirmPassword: 'short' }))
    expect(result.errors).toMatchObject({ password: expect.any(String) })
    await resetMemberPassword({}, form({ confirmPassword: 'something different' }))
    expect(mocks.find).not.toHaveBeenCalled()
    expect(mocks.state.statements).toEqual([])
  })

  it('refuses a used or expired link without hashing or writing anything', async () => {
    mocks.find.mockResolvedValue(null)
    await expect(resetMemberPassword({}, form())).resolves.toEqual({ formError: expect.stringContaining('expired') })
    expect(mocks.hash).not.toHaveBeenCalled()
    expect(mocks.state.statements).toEqual([])
  })

  it('refuses the link and sends no notice when it was used up between the lookup and the write', async () => {
    mocks.state.resetRows = []
    await expect(resetMemberPassword({}, form())).resolves.toEqual({ formError: expect.stringContaining('expired') })
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it('refuses a malformed token without touching the database', async () => {
    await expect(resetMemberPassword({}, form({ token: 'nope' }))).resolves.toEqual({
      formError: expect.stringContaining('expired'),
    })
    expect(mocks.find).not.toHaveBeenCalled()
  })

  it('still finishes the reset when the notice email fails, logging it', async () => {
    mocks.sendEmail.mockRejectedValueOnce(new EmailSendError('validation_error'))
    await expect(resetMemberPassword({}, form())).rejects.toThrow('REDIRECT /login?reset=1')
    expect(console.error).toHaveBeenCalledWith('EMAIL SEND FAILED: password_changed')
  })
})
