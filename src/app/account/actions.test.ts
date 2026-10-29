// @vitest-environment node
import type { SQL } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Statement = { sql: string; params: unknown[] }

const mocks = vi.hoisted(() => {
  class Redirect extends Error {
    constructor(readonly url: string) {
      super(`REDIRECT ${url}`)
    }
  }
  const state = {
    calls: [] as string[],
    member: { id: 7, email: 'mia@example.com', name: 'Mia', passwordHash: '$2b$12$stored' } as Record<
      string,
      unknown
    > | null,
    knownTopics: [] as { id: number }[],
    subscribed: [] as number[],
    updates: [] as Record<string, unknown>[],
    batches: [] as Statement[][],
  }
  return {
    Redirect,
    state,
    db: null as unknown,
    requireMember: vi.fn(async () => {
      state.calls.push('requireMember')
      return { user: { id: '7', email: 'mia@example.com', name: 'Mia', kind: 'member' } }
    }),
    recordLoginAttempt: vi.fn(async () => ({ throttled: false })),
    recordRequest: vi.fn(async () => ({ throttled: false })),
    clearLoginAttempts: vi.fn(async () => {}),
    compare: vi.fn(async () => true),
    hash: vi.fn(async (_password: string, cost: number) => `$2b$${cost}$new-hash`),
    signIn: vi.fn<(provider: string, options: Record<string, unknown>) => Promise<void>>(),
    signOut: vi.fn<(options: Record<string, unknown>) => Promise<void>>(),
    sendEmail: vi.fn<(message: { to: string; subject: string; text: string; html?: string }) => Promise<void>>(),
  }
})

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    mocks.state.calls.push(`redirect ${url}`)
    throw new mocks.Redirect(url)
  },
  unstable_rethrow: (error: unknown) => {
    if (error instanceof mocks.Redirect) throw error
  },
}))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.9' }) }))
vi.mock('@/lib/member', () => ({ requireMember: mocks.requireMember }))
vi.mock('@/lib/member-account', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/member-account')>()),
  findMemberForAction: async (id: number) => {
    mocks.state.calls.push(`findMember ${id}`)
    return mocks.state.member
  },
  getMemberTopicIds: async () => mocks.state.subscribed,
}))
vi.mock('@/lib/authorize', () => ({
  recordLoginAttempt: mocks.recordLoginAttempt,
  clearLoginAttempts: mocks.clearLoginAttempts,
}))
vi.mock('bcryptjs', () => ({ default: { compare: mocks.compare, hash: mocks.hash } }))
vi.mock('@/auth', () => ({ signIn: mocks.signIn, signOut: mocks.signOut }))
vi.mock('@/lib/email', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email')>()),
  sendEmail: mocks.sendEmail,
}))
vi.mock('@/lib/request-throttle', () => ({ recordRequest: mocks.recordRequest }))
vi.mock('@/lib/newsletter-topics', () => ({
  countExistingTopics: async (ids: number[]) =>
    ids.filter((id) => mocks.state.knownTopics.some((topic) => topic.id === id)).length,
}))
vi.mock('@/lib/site-url', () => ({ siteUrl: () => 'https://shpe.example' }))
vi.mock('@/db', async () => {
  const { neon } = await import('@neondatabase/serverless')
  const { drizzle } = await import('drizzle-orm/neon-http')
  const schema = await import('@/db/schema')
  const real = drizzle(neon('postgresql://user:password@localhost/unused'), { schema })
  mocks.db = new Proxy(real, {
    get(target, property, receiver) {
      if (property === 'batch') {
        return async (queries: { toSQL: () => Statement; updateValues?: Record<string, unknown> }[]) => {
          mocks.state.calls.push('batch')
          mocks.state.batches.push(queries.map((query) => query.toSQL()))
          for (const query of queries) if (query.updateValues) mocks.state.updates.push(query.updateValues)
          return queries.map(() => [])
        }
      }
      if (property === 'update') {
        return (table: typeof schema.members) => ({
          set: (values: Record<string, unknown>) => ({
            where: (condition: SQL | undefined) => {
              const query = real.update(table).set(values).where(condition)
              return {
                updateValues: values,
                toSQL: () => query.toSQL(),
                then: (resolve: () => void) => {
                  mocks.state.calls.push('update')
                  mocks.state.updates.push(values)
                  resolve()
                },
              }
            },
          }),
        })
      }
      return Reflect.get(target, property, receiver)
    },
  })
  return { getDb: () => mocks.db }
})

import { EmailSendError } from '@/lib/email'
import { hashToken } from '@/lib/member-tokens'
import { changePassword, deleteAccount, requestEmailChange, saveTopics, updateName } from './actions'

function form(entries: [string, string][]) {
  const data = new FormData()
  for (const [key, value] of entries) data.append(key, value)
  return data
}

/** Account results carry a per-submit nonce; it is checked here and left out of the comparison. */
function withoutNonce(url: string) {
  if (!url.startsWith('/account?')) return url
  const params = new URLSearchParams(url.slice('/account?'.length))
  expect(params.get('n')).toMatch(/^[0-9a-f]{8}$/)
  params.delete('n')
  return `/account?${params}`
}

async function redirectOf(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(mocks.Redirect)
  return withoutNonce((error as InstanceType<typeof mocks.Redirect>).url)
}

async function rawRedirectOf(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e)
  return (error as InstanceType<typeof mocks.Redirect>).url
}

const CURRENT = 'old password 123'
const NEW = 'new password 456'
const passwordForm = (overrides: Record<string, string> = {}) =>
  form(Object.entries({ currentPassword: CURRENT, newPassword: NEW, confirmPassword: NEW, ...overrides }))

const emailForm = (overrides: Record<string, string> = {}) =>
  form(Object.entries({ newEmail: 'Nina@New.example', currentPassword: CURRENT, ...overrides }))

beforeEach(() => {
  const { state } = mocks
  state.calls.length = 0
  state.member = { id: 7, email: 'mia@example.com', name: 'Mia', passwordHash: '$2b$12$stored' }
  state.knownTopics = []
  state.subscribed = []
  state.updates.length = 0
  state.batches.length = 0
  mocks.requireMember.mockClear()
  mocks.recordLoginAttempt.mockReset().mockResolvedValue({ throttled: false })
  mocks.recordRequest.mockReset().mockResolvedValue({ throttled: false })
  mocks.clearLoginAttempts.mockClear()
  mocks.compare.mockReset().mockResolvedValue(true)
  mocks.hash.mockClear()
  mocks.sendEmail.mockReset().mockResolvedValue(undefined)
  mocks.signIn.mockReset().mockImplementation(async (_provider, options) => {
    throw new mocks.Redirect(String(options.redirectTo))
  })
  mocks.signOut.mockReset().mockImplementation(async (options) => {
    mocks.state.calls.push('signOut')
    throw new mocks.Redirect(String(options.redirectTo))
  })
})

describe.each([
  ['updateName', () => updateName(form([['name', 'Mia']]))],
  ['changePassword', () => changePassword(passwordForm())],
  ['requestEmailChange', () => requestEmailChange(emailForm())],
  ['saveTopics', () => saveTopics(form([['topics', '1']]))],
  ['deleteAccount', () => deleteAccount(form([['password', CURRENT], ['confirm', 'DELETE']]))],
])('%s', (_, run) => {
  it('requires a member before doing anything', async () => {
    mocks.requireMember.mockRejectedValueOnce(new mocks.Redirect('/login'))
    expect(await redirectOf(run())).toBe('/login')
    expect(mocks.state.calls).toEqual([])
  })

  it('re-reads the member by session id and stops if the row is gone', async () => {
    mocks.state.member = null
    expect(await redirectOf(run())).toBe('/login')
    expect(mocks.state.calls).toEqual(['requireMember', 'findMember 7', 'redirect /login'])
  })
})

describe('updateName', () => {
  it('saves a trimmed name', async () => {
    expect(await redirectOf(updateName(form([['name', '  Mia Flores ']])))).toBe('/account?saved=name')
    expect(mocks.state.updates).toEqual([{ name: 'Mia Flores' }])
  })

  it('rejects a name with a line break', async () => {
    expect(await redirectOf(updateName(form([['name', 'Mia\nAdmin']])))).toBe('/account?error=name')
    expect(mocks.state.updates).toEqual([])
  })
})

describe('changePassword', () => {
  it('rejects a wrong current password as a throttled attempt and changes nothing', async () => {
    mocks.compare.mockResolvedValueOnce(false)
    expect(await redirectOf(changePassword(passwordForm()))).toBe('/account?error=password-current')
    expect(mocks.recordLoginAttempt).toHaveBeenCalledWith('mia@example.com', '203.0.113.9')
    expect(mocks.state.updates).toEqual([])
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it('refuses when throttled without checking the password', async () => {
    mocks.recordLoginAttempt.mockResolvedValueOnce({ throttled: true })
    expect(await redirectOf(changePassword(passwordForm()))).toBe('/account?error=password-throttled')
    expect(mocks.compare).not.toHaveBeenCalled()
  })

  it('reports validation errors with a password- prefix', async () => {
    expect(await redirectOf(changePassword(passwordForm({ confirmPassword: 'different pass 1' })))).toBe(
      '/account?error=password-mismatch',
    )
  })

  it('stores the new hash, stamps the change, notifies the member and re-signs this device in', async () => {
    expect(await redirectOf(changePassword(passwordForm()))).toBe('/account?saved=password')
    expect(mocks.state.updates).toHaveLength(1)
    expect(mocks.state.updates[0]).toMatchObject({ passwordHash: '$2b$12$new-hash' })
    expect(mocks.state.updates[0].passwordChangedAt).toBeInstanceOf(Date)
    expect(mocks.clearLoginAttempts).toHaveBeenCalledWith('mia@example.com')
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'mia@example.com', subject: 'Your SHPE @ CMU password was changed' }),
    )
    expect(mocks.sendEmail.mock.calls[0][0]).toMatchObject({ text: expect.stringContaining('https://shpe.example/contact') })
    expect(mocks.signIn).toHaveBeenCalledWith('credentials', {
      email: 'mia@example.com',
      password: NEW,
      redirectTo: expect.stringMatching(/^\/account\?saved=password&n=[0-9a-f]{8}$/),
    })
  })

  it('cancels pending reset links in the same batch as the password change', async () => {
    expect(await redirectOf(changePassword(passwordForm()))).toBe('/account?saved=password')
    expect(mocks.state.batches).toHaveLength(1)
    const [update, cancelResets] = mocks.state.batches[0]
    expect(update.sql).toMatch(/^update "members" set "password_hash" = \$1, "password_changed_at" = \$2 where/)
    expect(cancelResets.sql).toMatch(/^delete from "member_tokens" where/)
    expect(cancelResets.params).toEqual([7, 'reset_password'])
  })

  it('still finishes the change when the notice fails, logging only a tag', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.sendEmail.mockRejectedValueOnce(new Error('domain not verified'))
    expect(await redirectOf(changePassword(passwordForm()))).toBe('/account?saved=password')
    expect(consoleError).toHaveBeenCalledWith('EMAIL SEND FAILED: password_changed')
    consoleError.mockRestore()
  })
})

describe('requestEmailChange', () => {
  it('stores a hashed 24-hour pending change, replacing older ones, and emails the link to the new address only', async () => {
    const before = Date.now()
    expect(await redirectOf(requestEmailChange(emailForm()))).toBe('/account?saved=email')
    expect(mocks.recordRequest).toHaveBeenCalledWith('change_email', 'mia@example.com', '203.0.113.9')
    expect(mocks.recordLoginAttempt).not.toHaveBeenCalled()
    expect(mocks.compare).toHaveBeenCalledWith(CURRENT, '$2b$12$stored')

    const [[purge, upsert]] = mocks.state.batches
    expect(purge.sql).toBe('delete from "member_email_changes" where "member_email_changes"."expires_at" < now()')
    expect(upsert.sql).toMatch(/^insert into "member_email_changes" .* on conflict \("member_id"\) do update set/)
    const [memberId, newEmail, tokenHash, expiresAt] = upsert.params as [number, string, string, string]
    expect(memberId).toBe(7)
    expect(newEmail).toBe('nina@new.example')
    expect(Date.parse(expiresAt) - before).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000)
    expect(Date.parse(expiresAt) - before).toBeLessThan(24 * 60 * 60 * 1000 + 60_000)

    expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
    const message = mocks.sendEmail.mock.calls[0][0]
    expect(message).toMatchObject({ to: 'nina@new.example', subject: 'Confirm your new email for SHPE @ CMU' })
    const token = message.text.match(/https:\/\/shpe\.example\/account\/confirm-email\?token=([A-Za-z0-9_-]{43})\n/)?.[1]
    expect(token).toBeDefined()
    expect(hashToken(token!)).toBe(tokenHash)
    expect(mocks.state.updates).toEqual([])
  })

  it.each([
    ['an invalid address', { newEmail: 'nope' }, '/account?error=email-invalid'],
    ['a missing password', { currentPassword: '' }, '/account?error=email-password'],
    ['the current address in another case', { newEmail: 'MIA@example.com' }, '/account?error=email-same'],
  ])('refuses %s before any limit, password check or write', async (_case, overrides, path) => {
    expect(await redirectOf(requestEmailChange(emailForm(overrides)))).toBe(path)
    expect(mocks.recordRequest).not.toHaveBeenCalled()
    expect(mocks.compare).not.toHaveBeenCalled()
    expect(mocks.state.batches).toEqual([])
  })

  it('refuses a wrong current password without storing or sending anything', async () => {
    mocks.compare.mockResolvedValue(false)
    expect(await redirectOf(requestEmailChange(emailForm()))).toBe('/account?error=email-current')
    expect(mocks.state.batches).toEqual([])
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it('refuses when its own limit is reached, before checking the password', async () => {
    mocks.recordRequest.mockResolvedValue({ throttled: true })
    expect(await redirectOf(requestEmailChange(emailForm()))).toBe('/account?error=email-throttled')
    expect(mocks.compare).not.toHaveBeenCalled()
    expect(mocks.state.batches).toEqual([])
  })

  it('reports a failed send without saying anything about the new address', async () => {
    mocks.sendEmail.mockRejectedValue(new EmailSendError('validation_error'))
    expect(await redirectOf(requestEmailChange(emailForm()))).toBe('/account?error=email-send')
  })
})

describe('saveTopics', () => {
  it('rejects ids that are not existing topics without writing', async () => {
    mocks.state.knownTopics = [{ id: 1 }]
    expect(await redirectOf(saveTopics(form([['topics', '1'], ['topics', '99']])))).toBe('/account?error=topics')
    expect(mocks.state.batches).toEqual([])
  })

  it('rejects malformed ids', async () => {
    expect(await redirectOf(saveTopics(form([['topics', 'all']])))).toBe('/account?error=topics')
    expect(mocks.state.batches).toEqual([])
  })

  it('inserts only new choices and deletes only dropped ones, so kept opt-in times are untouched', async () => {
    mocks.state.knownTopics = [{ id: 2 }, { id: 3 }]
    mocks.state.subscribed = [1, 2]
    expect(await redirectOf(saveTopics(form([['topics', '2'], ['topics', '3']])))).toBe('/account?saved=topics')
    expect(mocks.state.batches).toHaveLength(1)
    const [insert, remove] = mocks.state.batches[0]
    expect(insert.sql).toBe(
      'insert into "member_topic_subscriptions" ("id", "member_id", "topic_id", "opted_in_at") values (default, $1, $2, default) on conflict ("member_id","topic_id") do nothing',
    )
    expect(insert.params).toEqual([7, 3])
    expect(remove.sql).toBe(
      'delete from "member_topic_subscriptions" where ("member_topic_subscriptions"."member_id" = $1 and "member_topic_subscriptions"."topic_id" in ($2))',
    )
    expect(remove.params).toEqual([7, 1])
    expect(mocks.state.batches[0].some((statement) => statement.sql.startsWith('update'))).toBe(false)
  })

  it('writes nothing when the choices did not change', async () => {
    mocks.state.knownTopics = [{ id: 2 }]
    mocks.state.subscribed = [2]
    expect(await redirectOf(saveTopics(form([['topics', '2']])))).toBe('/account?saved=topics')
    expect(mocks.state.batches).toEqual([])
  })

  it('unsubscribes from everything when nothing is checked', async () => {
    mocks.state.subscribed = [4]
    await redirectOf(saveTopics(form([])))
    expect(mocks.state.batches[0]).toHaveLength(1)
    expect(mocks.state.batches[0][0].sql).toMatch(/^delete from "member_topic_subscriptions"/)
  })
})

describe('deleteAccount', () => {
  const deleteForm = (password = CURRENT, confirm = 'DELETE') =>
    form([
      ['password', password],
      ['confirm', confirm],
    ])

  it('requires the confirmation word before checking the password', async () => {
    expect(await redirectOf(deleteAccount(deleteForm(CURRENT, 'yes')))).toBe('/account?error=delete-confirm')
    expect(mocks.compare).not.toHaveBeenCalled()
    expect(mocks.state.batches).toEqual([])
  })

  it('refuses a wrong password and keeps the account', async () => {
    mocks.compare.mockResolvedValueOnce(false)
    expect(await redirectOf(deleteAccount(deleteForm('guess')))).toBe('/account?error=delete-current')
    expect(mocks.recordLoginAttempt).toHaveBeenCalledWith('mia@example.com', '203.0.113.9')
    expect(mocks.state.batches).toEqual([])
    expect(mocks.signOut).not.toHaveBeenCalled()
  })

  it('refuses when throttled without checking the password', async () => {
    mocks.recordLoginAttempt.mockResolvedValueOnce({ throttled: true })
    expect(await redirectOf(deleteAccount(deleteForm()))).toBe('/account?error=delete-throttled')
    expect(mocks.compare).not.toHaveBeenCalled()
  })

  it('deletes throttle records and the member in one batch, then signs out', async () => {
    expect(await redirectOf(deleteAccount(deleteForm()))).toBe('/account/deleted')
    expect(mocks.compare).toHaveBeenCalledWith(CURRENT, '$2b$12$stored')
    expect(mocks.state.calls.slice(-2)).toEqual(['batch', 'signOut'])
    const statements = mocks.state.batches[0]
    expect(statements.map((statement) => statement.sql.split(' where ')[0])).toEqual([
      'delete from "request_throttle"',
      'delete from "login_attempts"',
      'delete from "members"',
    ])
    expect(statements.every((statement) => statement.params.every((param) => param === 7))).toBe(true)
    expect(mocks.signOut).toHaveBeenCalledWith({ redirectTo: '/account/deleted' })
  })
})

describe('account results', () => {
  it('gives the same result twice in a row two different URLs, so the page refocuses its message', async () => {
    mocks.compare.mockResolvedValue(false)
    const first = await rawRedirectOf(changePassword(passwordForm()))
    const second = await rawRedirectOf(changePassword(passwordForm()))
    expect(withoutNonce(first)).toBe('/account?error=password-current')
    expect(withoutNonce(second)).toBe('/account?error=password-current')
    expect(first).not.toBe(second)
  })
})
