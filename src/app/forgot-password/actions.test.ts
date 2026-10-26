import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

type Write = { kind: string; table: string; values?: Record<string, unknown>; where?: SQL }

const mocks = vi.hoisted(() => {
  const state = {
    admin: null as { id: number } | null,
    confirmedMember: null as { id: number; name: string } | null,
    memberWhere: null as SQL | null,
    batches: [] as Write[][],
    throttled: false,
  }
  const tableName = (table: unknown) => (table as Record<symbol, string>)[Symbol.for('drizzle:Name')]
  return {
    state,
    db: {
      select: () => {
        let table = ''
        const query = {
          from: (source: unknown) => {
            table = tableName(source)
            return query
          },
          where: (where: SQL) => {
            if (table === 'members') state.memberWhere = where
            return query
          },
          limit: async () => {
            if (table === 'admins') return state.admin ? [state.admin] : []
            return state.confirmedMember ? [state.confirmedMember] : []
          },
        }
        return query
      },
      insert: (table: unknown) => ({ values: (values: Record<string, unknown>) => ({ kind: 'insert', table: tableName(table), values }) }),
      delete: (table: unknown) => ({ where: (where: SQL) => ({ kind: 'delete', table: tableName(table), where }) }),
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
import { requestPasswordReset } from './actions'

function form(email = 'Mia@Example.com') {
  const formData = new FormData()
  formData.set('email', email)
  return formData
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(mocks.state, { admin: null, confirmedMember: null, memberWhere: null, batches: [], throttled: false })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('requestPasswordReset', () => {
  it('sends a confirmed member a 1-hour link, replacing their older reset links', async () => {
    mocks.state.confirmedMember = { id: 7, name: 'Mia' }
    await expect(requestPasswordReset({}, form())).rejects.toThrow('REDIRECT /forgot-password?sent=1')
    const [[revoke, insert]] = mocks.state.batches
    expect(new PgDialect().sqlToQuery(revoke.where!).params).toEqual([7, 'reset_password'])
    expect(insert.values).toMatchObject({ memberId: 7, purpose: 'reset_password' })
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
    const message = mocks.sendEmail.mock.calls[0][0]
    expect(message).toMatchObject({ to: 'mia@example.com', subject: 'Reset your SHPE @ CMU password' })
    expect(message.text).toMatch(/https:\/\/shpe\.test\/reset-password\?token=[A-Za-z0-9_-]{43}\n/)
  })

  it('only looks for members whose email is confirmed', async () => {
    await expect(requestPasswordReset({}, form())).rejects.toThrow('REDIRECT')
    expect(new PgDialect().sqlToQuery(mocks.state.memberWhere!).sql).toBe(
      '("members"."email" = $1 and "members"."email_confirmed_at" is not null)',
    )
  })

  it.each([
    ['an unknown or unconfirmed email', () => {}],
    ['an admin email', () => (mocks.state.admin = { id: 1 })],
    ['an admin email that a member row also has', () => {
      mocks.state.admin = { id: 1 }
      mocks.state.confirmedMember = { id: 7, name: 'Mia' }
    }],
    ['a throttled request', () => {
      mocks.state.throttled = true
      mocks.state.confirmedMember = { id: 7, name: 'Mia' }
    }],
  ])('sends nothing for %s, with the same response', async (_case, arrange) => {
    arrange()
    await expect(requestPasswordReset({}, form())).rejects.toThrow('REDIRECT /forgot-password?sent=1')
    expect(mocks.sendEmail).not.toHaveBeenCalled()
    expect(mocks.state.batches).toEqual([])
  })

  it('logs a failed send under a stable tag and still gives the same response', async () => {
    mocks.state.confirmedMember = { id: 7, name: 'Mia' }
    mocks.sendEmail.mockRejectedValueOnce(new EmailSendError('validation_error'))
    await expect(requestPasswordReset({}, form())).rejects.toThrow('REDIRECT /forgot-password?sent=1')
    expect(console.error).toHaveBeenCalledWith('EMAIL SEND FAILED: reset_password')
  })

  it('asks again for an invalid email without recording anything', async () => {
    await expect(requestPasswordReset({}, form('nope'))).resolves.toMatchObject({ errors: { email: expect.any(String) } })
    expect(mocks.recordRequest).not.toHaveBeenCalled()
  })
})
