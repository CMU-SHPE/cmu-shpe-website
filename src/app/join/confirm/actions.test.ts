import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

const mocks = vi.hoisted(() => {
  const state = {
    member: { email: 'mia@example.com', passwordHash: '$2b$12$signed-up' } as { email: string; passwordHash: string } | null,
    ops: [] as string[],
    batches: [] as SQL[][],
    confirmedRows: 1,
  }
  return {
    state,
    find: vi.fn<(token: string) => Promise<{ memberId: number; signUp: SignUpDetails | null } | null>>(),
    recordRequest: vi.fn<(action: string, email: string, ip: string | null) => Promise<{ throttled: boolean }>>(),
    compare: vi.fn<(password: string, hash: string) => Promise<boolean>>(),
    db: {
      select: () => {
        const query = {
          from: () => query,
          where: () => query,
          limit: async () => (state.member ? [state.member] : []),
        }
        return query
      },
      execute: (statement: SQL) => statement,
      batch: async (statements: SQL[]) => {
        state.ops.push('batch')
        state.batches.push(statements)
        return [{ rows: [{ id: 7 }] }, { rows: Array.from({ length: state.confirmedRows }, () => ({ id: 7 })) }]
      },
    },
    redirect: vi.fn((url: string) => {
      throw new Error(`REDIRECT ${url}`)
    }),
  }
})

vi.mock('@/db', () => ({ getDb: () => mocks.db }))
vi.mock('@/lib/member-tokens', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/member-tokens')>()),
  findConfirmEmailLink: mocks.find,
}))
vi.mock('@/lib/request-throttle', () => ({ recordRequest: mocks.recordRequest }))
vi.mock('bcryptjs', () => ({ default: { compare: mocks.compare } }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.7' }) }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))

import { hashToken, type SignUpDetails } from '@/lib/member-tokens'
import { confirmMemberEmail } from './actions'

const TOKEN = 'A'.repeat(43)
const MISMATCH =
  "That password doesn't match the sign-up this link was sent for. If you signed up more than once, use the link from the email that followed the sign-up whose password you know, or sign up again."
const LINKED_SIGN_UP: SignUpDetails = {
  name: 'Mia From The Link',
  passwordHash: '$2b$12$this-link',
  privacyPolicyVersion: 'October 2026',
  ageConfirmedAt: new Date('2026-11-01T10:00:00Z'),
  termsAcceptedAt: new Date('2026-11-01T10:00:00Z'),
}

function form(fields: { token?: string; password?: string }) {
  const formData = new FormData()
  for (const [name, value] of Object.entries(fields)) if (value !== undefined) formData.set(name, value)
  return formData
}

function confirm(fields: { token?: string; password?: string }) {
  return confirmMemberEmail({}, form(fields)).then(
    (state) => ({ state }),
    (error: Error) => ({ thrown: error.message }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.state.member = { email: 'mia@example.com', passwordHash: '$2b$12$signed-up' }
  mocks.state.ops = []
  mocks.state.batches = []
  mocks.state.confirmedRows = 1
  mocks.find.mockResolvedValue({ memberId: 7, signUp: LINKED_SIGN_UP })
  mocks.recordRequest.mockImplementation(async () => {
    mocks.state.ops.push('throttle')
    return { throttled: false }
  })
  mocks.compare.mockImplementation(async (password) => {
    mocks.state.ops.push('compare')
    return password === 'the signed-up password'
  })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

const render = (statement: SQL) => {
  const { sql, params } = new PgDialect().sqlToQuery(statement)
  return { sql: sql.replace(/\s+/g, ' ').trim(), params }
}

describe('confirmMemberEmail', () => {
  it('checks the link’s own password, then locks the member and confirms in one statement', async () => {
    mocks.compare.mockImplementation(async (password, hash) => {
      mocks.state.ops.push('compare')
      return password === 'the signed-up password' && hash === '$2b$12$this-link'
    })
    await expect(confirm({ token: TOKEN, password: 'the signed-up password' })).resolves.toEqual({
      thrown: 'REDIRECT /login?confirmed=1',
    })
    expect(mocks.find).toHaveBeenCalledWith(TOKEN)
    expect(mocks.recordRequest).toHaveBeenCalledWith('confirm_email', 'mia@example.com', '203.0.113.7')
    expect(mocks.compare).toHaveBeenCalledWith('the signed-up password', '$2b$12$this-link')
    expect(mocks.state.ops).toEqual(['throttle', 'compare', 'batch'])

    const [[lock, write]] = mocks.state.batches
    expect(render(lock)).toEqual({ sql: 'select id from members where id = $1 for update', params: [7] })
    const { sql, params } = render(write)
    expect(sql).toMatch(
      /^with consumed as \( delete from member_tokens t using members m where t\.token_hash = \$1 and t\.purpose = 'confirm_email' and t\.expires_at > now\(\) and m\.id = t\.member_id and m\.email_confirmed_at is null and coalesce\(t\.password_hash, m\.password_hash\) = \$2 returning/,
    )
    expect(sql).toContain('name = coalesce(c.name, m.name), password_hash = coalesce(c.password_hash, m.password_hash)')
    expect(sql).toContain('where m.id = c.member_id and m.email_confirmed_at is null returning m.id')
    expect(sql).toContain("delete from member_tokens t using confirmed where t.member_id = confirmed.id and t.purpose = 'confirm_email' and t.token_hash <> $4")
    expect(params).toEqual([hashToken(TOKEN), '$2b$12$this-link', expect.any(String), hashToken(TOKEN)])
  })

  it('checks a link with no sign-up of its own against the member row’s password', async () => {
    mocks.find.mockResolvedValue({ memberId: 7, signUp: null })
    await expect(confirm({ token: TOKEN, password: 'the signed-up password' })).resolves.toEqual({
      thrown: 'REDIRECT /login?confirmed=1',
    })
    expect(mocks.compare).toHaveBeenCalledWith('the signed-up password', '$2b$12$signed-up')
    expect(render(mocks.state.batches[0][1]).params[1]).toBe('$2b$12$signed-up')
  })

  it('refuses a wrong password with one generic message, leaving the link unused and the account unconfirmed', async () => {
    await expect(confirm({ token: TOKEN, password: 'a later sign-up password' })).resolves.toEqual({
      state: { formError: MISMATCH },
    })
    expect(mocks.state.batches).toEqual([])
  })

  it('asks for the password when it is left blank, without counting an attempt or using the link', async () => {
    await expect(confirm({ token: TOKEN })).resolves.toEqual({
      state: { errors: { password: 'Enter the password you chose when you signed up.' } },
    })
    await expect(confirm({ token: TOKEN, password: '' })).resolves.toMatchObject({
      state: { errors: { password: expect.any(String) } },
    })
    expect(mocks.recordRequest).not.toHaveBeenCalled()
    expect(mocks.compare).not.toHaveBeenCalled()
    expect(mocks.state.batches).toEqual([])
  })

  it('stops checking passwords once throttled, leaving the link unused', async () => {
    mocks.recordRequest.mockResolvedValue({ throttled: true })
    await expect(confirm({ token: TOKEN, password: 'the signed-up password' })).resolves.toEqual({
      state: { formError: 'Too many attempts. Wait 15 minutes and try again.' },
    })
    expect(mocks.compare).not.toHaveBeenCalled()
    expect(mocks.state.batches).toEqual([])
  })

  it('shows the invalid-link page for a used, expired or missing token, checking no password', async () => {
    mocks.find.mockResolvedValue(null)
    await expect(confirm({ token: TOKEN, password: 'the signed-up password' })).resolves.toEqual({
      thrown: 'REDIRECT /join/confirm?invalid=1',
    })
    await expect(confirm({ password: 'the signed-up password' })).resolves.toEqual({
      thrown: 'REDIRECT /join/confirm?invalid=1',
    })
    expect(mocks.find).toHaveBeenCalledTimes(1)
    expect(mocks.recordRequest).not.toHaveBeenCalled()
    expect(mocks.compare).not.toHaveBeenCalled()
    expect(mocks.state.batches).toEqual([])
  })

  it('shows the invalid-link page when the link was used up, or the account confirmed, before the write', async () => {
    mocks.state.confirmedRows = 0
    await expect(confirm({ token: TOKEN, password: 'the signed-up password' })).resolves.toEqual({
      thrown: 'REDIRECT /join/confirm?invalid=1',
    })
    expect(mocks.state.ops).toEqual(['throttle', 'compare', 'batch'])
  })

  it('shows the invalid-link page when the account behind the link is gone', async () => {
    mocks.state.member = null
    await expect(confirm({ token: TOKEN, password: 'the signed-up password' })).resolves.toEqual({
      thrown: 'REDIRECT /join/confirm?invalid=1',
    })
    expect(mocks.compare).not.toHaveBeenCalled()
  })
})
