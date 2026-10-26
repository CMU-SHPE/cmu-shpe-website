import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

type Write = { kind: string; table: string; values?: Record<string, unknown>; where?: SQL }

const mocks = vi.hoisted(() => {
  const state = {
    unconfirmed: null as { id: number; name: string } | null,
    memberWhere: null as SQL | null,
    ops: [] as string[],
    batches: [] as Write[][],
    throttled: false,
  }
  const tableName = (table: unknown) => (table as Record<symbol, string>)[Symbol.for('drizzle:Name')]
  return {
    state,
    db: {
      select: () => {
        const query = {
          from: () => query,
          where: (where: SQL) => {
            state.memberWhere = where
            return query
          },
          limit: async () => {
            state.ops.push('find member')
            return state.unconfirmed ? [state.unconfirmed] : []
          },
        }
        return query
      },
      insert: (table: unknown) => ({ values: (values: Record<string, unknown>) => ({ kind: 'insert', table: tableName(table), values }) }),
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
        state.batches.push(writes)
      },
    },
    sendEmail: vi.fn<(message: { to: string; subject: string; text: string }) => Promise<void>>(async () => {}),
    recordRequest: vi.fn(async () => ({ throttled: mocks.state.throttled })),
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
vi.mock('@/lib/request-throttle', () => ({ recordRequest: mocks.recordRequest }))
vi.mock('@/lib/site-url', () => ({ siteUrl: () => 'https://shpe.test' }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))

import { EmailSendError } from '@/lib/email'
import { resendConfirmation } from './actions'

function form(email = 'Mia@Example.com') {
  const formData = new FormData()
  formData.set('email', email)
  return formData
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(mocks.state, { unconfirmed: null, memberWhere: null, ops: [], batches: [], throttled: false })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('resendConfirmation', () => {
  it('replaces an unconfirmed member’s links with a fresh one and emails it', async () => {
    mocks.state.unconfirmed = { id: 7, name: 'Mia' }
    await expect(resendConfirmation({}, form())).rejects.toThrow('REDIRECT /join/resend?sent=1')
    expect(mocks.recordRequest).toHaveBeenCalledWith('resend_confirmation', 'mia@example.com', null)
    expect(mocks.state.ops).toEqual(['purge members', 'find member'])
    const [[revoke, insert]] = mocks.state.batches
    expect(new PgDialect().sqlToQuery(revoke.where!).params).toEqual([7, 'confirm_email'])
    expect(insert.values).toMatchObject({ memberId: 7, purpose: 'confirm_email' })
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
    expect(mocks.sendEmail.mock.calls[0][0].text).toMatch(/\/join\/confirm\?token=[A-Za-z0-9_-]{43}\n/)
  })

  it('only looks for unconfirmed members', async () => {
    await expect(resendConfirmation({}, form())).rejects.toThrow('REDIRECT')
    expect(new PgDialect().sqlToQuery(mocks.state.memberWhere!).sql).toBe(
      '("members"."email" = $1 and "members"."email_confirmed_at" is null)',
    )
  })

  it('sends nothing for an unknown or already-confirmed email, with the same response', async () => {
    await expect(resendConfirmation({}, form())).rejects.toThrow('REDIRECT /join/resend?sent=1')
    expect(mocks.sendEmail).not.toHaveBeenCalled()
    expect(mocks.state.batches).toEqual([])
  })

  it('sends nothing when throttled, with the same response', async () => {
    mocks.state.throttled = true
    mocks.state.unconfirmed = { id: 7, name: 'Mia' }
    await expect(resendConfirmation({}, form())).rejects.toThrow('REDIRECT /join/resend?sent=1')
    expect(mocks.state.ops).toEqual([])
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it('logs a failed send instead of revealing that the account exists', async () => {
    mocks.state.unconfirmed = { id: 7, name: 'Mia' }
    mocks.sendEmail.mockRejectedValueOnce(new EmailSendError('validation_error'))
    await expect(resendConfirmation({}, form())).rejects.toThrow('REDIRECT /join/resend?sent=1')
    expect(console.error).toHaveBeenCalledWith('EMAIL SEND FAILED: confirm_email (resend)')
  })
})
