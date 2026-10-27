import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

const mocks = vi.hoisted(() => {
  const state = {
    member: { email: 'mia@example.com', passwordHash: '$2b$12$signed-up' } as { email: string; passwordHash: string } | null,
    ops: [] as string[],
    writes: [] as { kind: string; values?: Record<string, unknown>; where: SQL }[],
    updatedRows: 1,
  }
  return {
    state,
    find: vi.fn<(token: string, purpose: string) => Promise<number | null>>(),
    consume: vi.fn<(token: string, purpose: string) => Promise<number | null>>(),
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
      update: () => ({
        set: (values: Record<string, unknown>) => ({
          where: (where: SQL) => ({
            returning: async () => {
              state.ops.push('update')
              state.writes.push({ kind: 'update members', values, where })
              return Array.from({ length: state.updatedRows }, () => ({ id: 7 }))
            },
          }),
        }),
      }),
      delete: () => ({
        where: async (where: SQL) => {
          state.ops.push('revoke')
          state.writes.push({ kind: 'delete member_tokens', where })
        },
      }),
    },
    redirect: vi.fn((url: string) => {
      throw new Error(`REDIRECT ${url}`)
    }),
  }
})

vi.mock('@/db', () => ({ getDb: () => mocks.db }))
vi.mock('@/lib/member-tokens', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/member-tokens')>()),
  findMemberToken: mocks.find,
  consumeMemberToken: mocks.consume,
}))
vi.mock('@/lib/request-throttle', () => ({ recordRequest: mocks.recordRequest }))
vi.mock('bcryptjs', () => ({ default: { compare: mocks.compare } }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.7' }) }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))

import { confirmMemberEmail } from './actions'

const TOKEN = 'A'.repeat(43)
const MISMATCH =
  "That password doesn't match this sign-up. If you didn't make the most recent sign-up for this email, sign up again with the password you want."

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
  mocks.state.writes = []
  mocks.state.updatedRows = 1
  mocks.find.mockResolvedValue(7)
  mocks.consume.mockImplementation(async () => {
    mocks.state.ops.push('consume')
    return 7
  })
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

describe('confirmMemberEmail', () => {
  it('checks the sign-up password, then consumes the token, confirms the account and revokes its other links', async () => {
    await expect(confirm({ token: TOKEN, password: 'the signed-up password' })).resolves.toEqual({
      thrown: 'REDIRECT /login?confirmed=1',
    })
    expect(mocks.find).toHaveBeenCalledWith(TOKEN, 'confirm_email')
    expect(mocks.recordRequest).toHaveBeenCalledWith('confirm_email', 'mia@example.com', '203.0.113.7')
    expect(mocks.compare).toHaveBeenCalledWith('the signed-up password', '$2b$12$signed-up')
    expect(mocks.consume).toHaveBeenCalledWith(TOKEN, 'confirm_email')
    expect(mocks.state.ops).toEqual(['throttle', 'compare', 'consume', 'update', 'revoke'])

    const [confirmWrite, revoke] = mocks.state.writes
    expect(confirmWrite.values).toEqual({ emailConfirmedAt: expect.any(Date) })
    const { sql, params } = new PgDialect().sqlToQuery(confirmWrite.where)
    expect(sql).toBe(
      '("members"."id" = $1 and "members"."email_confirmed_at" is null and "members"."password_hash" = $2)',
    )
    expect(params).toEqual([7, '$2b$12$signed-up'])
    expect(new PgDialect().sqlToQuery(revoke.where).params).toEqual([7, 'confirm_email'])
  })

  it('refuses a wrong password with one generic message, leaving the link unused and the account unconfirmed', async () => {
    await expect(confirm({ token: TOKEN, password: 'a later sign-up password' })).resolves.toEqual({
      state: { formError: MISMATCH },
    })
    expect(mocks.consume).not.toHaveBeenCalled()
    expect(mocks.state.writes).toEqual([])
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
    expect(mocks.consume).not.toHaveBeenCalled()
  })

  it('stops checking passwords once throttled, leaving the link unused', async () => {
    mocks.recordRequest.mockResolvedValue({ throttled: true })
    await expect(confirm({ token: TOKEN, password: 'the signed-up password' })).resolves.toEqual({
      state: { formError: 'Too many attempts. Wait 15 minutes and try again.' },
    })
    expect(mocks.compare).not.toHaveBeenCalled()
    expect(mocks.consume).not.toHaveBeenCalled()
    expect(mocks.state.writes).toEqual([])
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
    expect(mocks.state.writes).toEqual([])
  })

  it('shows the invalid-link page when the link was used up between the password check and consuming it', async () => {
    mocks.consume.mockResolvedValue(null)
    await expect(confirm({ token: TOKEN, password: 'the signed-up password' })).resolves.toEqual({
      thrown: 'REDIRECT /join/confirm?invalid=1',
    })
    expect(mocks.state.writes).toEqual([])
  })

  it('shows the invalid-link page and revokes no links when the confirm write changed nothing', async () => {
    mocks.state.updatedRows = 0
    await expect(confirm({ token: TOKEN, password: 'the signed-up password' })).resolves.toEqual({
      thrown: 'REDIRECT /join/confirm?invalid=1',
    })
    expect(mocks.state.ops).toEqual(['throttle', 'compare', 'consume', 'update'])
  })

  it('shows the invalid-link page when the account behind the link is gone', async () => {
    mocks.state.member = null
    await expect(confirm({ token: TOKEN, password: 'the signed-up password' })).resolves.toEqual({
      thrown: 'REDIRECT /join/confirm?invalid=1',
    })
    expect(mocks.compare).not.toHaveBeenCalled()
  })
})
