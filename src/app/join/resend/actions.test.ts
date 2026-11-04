import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

const mocks = vi.hoisted(() => {
  const state = {
    unconfirmed: null as { id: number; name: string } | null,
    memberWhere: null as SQL | null,
    ops: [] as string[],
    inserts: [] as SQL[],
    confirmedMeanwhile: false,
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
      execute: async (statement: SQL) => {
        state.ops.push('insert member_tokens')
        state.inserts.push(statement)
        return { rows: state.confirmedMeanwhile ? [] : [{ member_id: 7 }] }
      },
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
    },
    sendEmail: vi.fn<(message: { to: string; subject: string; text: string }) => Promise<void>>(async () => {}),
    recordRequest: vi.fn(async () => ({ throttled: mocks.state.throttled })),
    redirect: vi.fn((url: string) => {
      throw new Error(`REDIRECT ${url}`)
    }),
    afterCallbacks: [] as (() => Promise<void>)[],
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
vi.mock('next/server', () => ({ after: (callback: () => Promise<void>) => mocks.afterCallbacks.push(callback) }))

import { EmailSendError } from '@/lib/email'
import { resendConfirmation } from './actions'

async function runAfterResponse() {
  for (const callback of mocks.afterCallbacks.splice(0)) await callback()
}

function form(email = 'Mia@Example.com') {
  const formData = new FormData()
  formData.set('email', email)
  return formData
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.afterCallbacks.length = 0
  Object.assign(mocks.state, { unconfirmed: null, memberWhere: null, ops: [], inserts: [], confirmedMeanwhile: false, throttled: false })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('resendConfirmation', () => {
  it('adds a fresh link for an unconfirmed member, leaving earlier links working, and emails it', async () => {
    mocks.state.unconfirmed = { id: 7, name: 'Mia Lopez' }
    await expect(resendConfirmation({}, form())).rejects.toThrow('REDIRECT /join/resend?sent=1')
    await runAfterResponse()
    expect(mocks.recordRequest).toHaveBeenCalledWith('resend_confirmation', 'mia@example.com', null)
    expect(mocks.state.ops).toEqual(['purge members', 'find member', 'insert member_tokens'])
    const [insert] = mocks.state.inserts
    const { sql, params } = new PgDialect().sqlToQuery(insert)
    expect(sql).toContain('insert into member_tokens')
    expect(sql).toMatch(/where \("members"\."id" = \$9 and "members"\."email_confirmed_at" is null\)\s+for share\s+returning member_id\s*$/)
    expect(params).toEqual([
      'confirm_email',
      expect.stringMatching(/^[0-9a-f]{64}$/),
      expect.any(String),
      null,
      null,
      null,
      null,
      null,
      7,
    ])
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
    expect(mocks.sendEmail.mock.calls[0][0].text).toMatch(/\/join\/confirm\?token=[A-Za-z0-9_-]{43}\n/)
    expect(mocks.sendEmail.mock.calls[0][0].text.startsWith('Hi,\n')).toBe(true)
    expect(mocks.sendEmail.mock.calls[0][0].text).not.toContain('Mia Lopez')
  })

  it('sends nothing when the member was confirmed or deleted after the lookup', async () => {
    mocks.state.unconfirmed = { id: 7, name: 'Mia Lopez' }
    mocks.state.confirmedMeanwhile = true
    await expect(resendConfirmation({}, form())).rejects.toThrow('REDIRECT /join/resend?sent=1')
    await runAfterResponse()
    expect(mocks.state.inserts).toHaveLength(1)
    expect(mocks.sendEmail).not.toHaveBeenCalled()
    expect(console.error).not.toHaveBeenCalled()
  })

  it('responds before looking anything up, then sends only to an unconfirmed member', async () => {
    mocks.state.unconfirmed = { id: 7, name: 'Mia' }
    await expect(resendConfirmation({}, form())).rejects.toThrow('REDIRECT /join/resend?sent=1')
    expect(mocks.state.ops).toEqual([])
    expect(mocks.state.inserts).toEqual([])
    expect(mocks.sendEmail).not.toHaveBeenCalled()
    await runAfterResponse()
    expect(mocks.state.ops).toEqual(['purge members', 'find member', 'insert member_tokens'])
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1)

    mocks.state.unconfirmed = null
    await expect(resendConfirmation({}, form('unknown@example.com'))).rejects.toThrow('REDIRECT /join/resend?sent=1')
    expect(mocks.afterCallbacks).toHaveLength(1)
    await runAfterResponse()
    expect(mocks.state.inserts).toHaveLength(1)
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
  })

  it('logs any other failure after responding instead of throwing', async () => {
    mocks.state.unconfirmed = { id: 7, name: 'Mia' }
    mocks.sendEmail.mockRejectedValueOnce(new Error('unexpected failure'))
    await expect(resendConfirmation({}, form())).rejects.toThrow('REDIRECT /join/resend?sent=1')
    await expect(runAfterResponse()).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalledWith('RESEND CONFIRMATION FAILED')
  })

  it('only looks for unconfirmed members', async () => {
    await expect(resendConfirmation({}, form())).rejects.toThrow('REDIRECT')
    await runAfterResponse()
    expect(new PgDialect().sqlToQuery(mocks.state.memberWhere!).sql).toBe(
      '("members"."email" = $1 and "members"."email_confirmed_at" is null)',
    )
  })

  it('sends nothing for an unknown or already-confirmed email, with the same response', async () => {
    await expect(resendConfirmation({}, form())).rejects.toThrow('REDIRECT /join/resend?sent=1')
    await runAfterResponse()
    expect(mocks.sendEmail).not.toHaveBeenCalled()
    expect(mocks.state.inserts).toEqual([])
  })

  it('sends nothing when throttled, with the same response', async () => {
    mocks.state.throttled = true
    mocks.state.unconfirmed = { id: 7, name: 'Mia' }
    await expect(resendConfirmation({}, form())).rejects.toThrow('REDIRECT /join/resend?sent=1')
    await runAfterResponse()
    expect(mocks.state.ops).toEqual([])
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it('logs a failed send instead of revealing that the account exists', async () => {
    mocks.state.unconfirmed = { id: 7, name: 'Mia' }
    mocks.sendEmail.mockRejectedValueOnce(new EmailSendError('validation_error'))
    await expect(resendConfirmation({}, form())).rejects.toThrow('REDIRECT /join/resend?sent=1')
    await runAfterResponse()
    expect(console.error).toHaveBeenCalledWith('EMAIL SEND FAILED: confirm_email (resend)')
  })
})
