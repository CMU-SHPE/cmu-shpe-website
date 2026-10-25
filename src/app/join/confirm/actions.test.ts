import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

const mocks = vi.hoisted(() => {
  const state = { batches: [] as { kind: string; values?: Record<string, unknown>; where: SQL }[][] }
  return {
    state,
    consume: vi.fn<(token: string, purpose: string) => Promise<number | null>>(),
    db: {
      update: () => ({
        set: (values: Record<string, unknown>) => ({ where: (where: SQL) => ({ kind: 'update members', values, where }) }),
      }),
      delete: () => ({ where: (where: SQL) => ({ kind: 'delete member_tokens', where }) }),
      batch: async (writes: { kind: string; values?: Record<string, unknown>; where: SQL }[]) => {
        state.batches.push(writes)
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
  consumeMemberToken: mocks.consume,
}))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))

import { confirmMemberEmail } from './actions'

const TOKEN = 'A'.repeat(43)

function form(token?: string) {
  const formData = new FormData()
  if (token !== undefined) formData.set('token', token)
  return formData
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.state.batches = []
})

describe('confirmMemberEmail', () => {
  it('consumes the token, confirms the account, revokes its other links, and sends them to sign in', async () => {
    mocks.consume.mockResolvedValue(7)
    await expect(confirmMemberEmail(form(TOKEN))).rejects.toThrow('REDIRECT /login?confirmed=1')
    expect(mocks.consume).toHaveBeenCalledWith(TOKEN, 'confirm_email')
    const [[confirm, revoke]] = mocks.state.batches
    expect(confirm.values).toEqual({ emailConfirmedAt: expect.any(Date) })
    expect(new PgDialect().sqlToQuery(confirm.where).sql).toBe(
      '("members"."id" = $1 and "members"."email_confirmed_at" is null)',
    )
    expect(new PgDialect().sqlToQuery(revoke.where).params).toEqual([7, 'confirm_email'])
  })

  it('shows the invalid-link page for a used, expired or missing token, writing nothing', async () => {
    mocks.consume.mockResolvedValue(null)
    await expect(confirmMemberEmail(form(TOKEN))).rejects.toThrow('REDIRECT /join/confirm?invalid=1')
    await expect(confirmMemberEmail(form())).rejects.toThrow('REDIRECT /join/confirm?invalid=1')
    expect(mocks.consume).toHaveBeenCalledTimes(1)
    expect(mocks.state.batches).toEqual([])
  })
})
