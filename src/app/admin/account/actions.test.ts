import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  class Redirect extends Error {
    constructor(readonly url: string) {
      super(`REDIRECT ${url}`)
    }
  }
  const state = {
    row: { id: 2, email: 'ana@example.com', passwordHash: '$2b$12$stored' } as Record<string, unknown> | null,
    updates: [] as Record<string, unknown>[],
  }
  const query = { from: () => query, where: () => query, limit: async () => (state.row ? [state.row] : []) }
  return {
    Redirect,
    state,
    db: {
      select: () => query,
      update: () => ({
        set: (values: Record<string, unknown>) => ({
          where: async () => {
            state.updates.push(values)
          },
        }),
      }),
    },
    requireAdmin: vi.fn(async () => ({ user: { id: '2', email: 'ana@example.com', role: 'admin' } })),
    recordLoginAttempt: vi.fn(async () => ({ throttled: false })),
    clearLoginAttempts: vi.fn(async () => {}),
    compare: vi.fn<(password: string, hash: string) => Promise<boolean>>(),
    hash: vi.fn(async (_password: string, cost: number) => `$2b$${cost}$new-hash`),
    signIn: vi.fn<(provider: string, options: Record<string, unknown>) => Promise<void>>(),
  }
})

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new mocks.Redirect(url)
  },
  unstable_rethrow: (error: unknown) => {
    if (error instanceof mocks.Redirect) throw error
  },
}))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }) }))
vi.mock('@/db', () => ({ getDb: () => mocks.db }))
vi.mock('@/lib/admin', () => ({ requireAdmin: mocks.requireAdmin }))
vi.mock('@/lib/authorize', () => ({
  recordLoginAttempt: mocks.recordLoginAttempt,
  clearLoginAttempts: mocks.clearLoginAttempts,
}))
vi.mock('bcryptjs', () => ({ default: { compare: mocks.compare, hash: mocks.hash } }))
vi.mock('@/auth', () => ({ signIn: mocks.signIn }))

import { changePassword } from './actions'

const CURRENT = 'old password 123'
const NEW = 'new password 456'

function form(overrides: Record<string, string> = {}) {
  const data = new FormData()
  const values = { currentPassword: CURRENT, newPassword: NEW, confirmPassword: NEW, ...overrides }
  for (const [key, value] of Object.entries(values)) data.set(key, value)
  return data
}

async function redirectOf(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    if (error instanceof mocks.Redirect) return error.url
    throw error
  }
  throw new Error('expected a redirect')
}

beforeEach(() => {
  mocks.state.row = { id: 2, email: 'ana@example.com', passwordHash: '$2b$12$stored' }
  mocks.state.updates = []
  mocks.requireAdmin.mockClear()
  mocks.recordLoginAttempt.mockReset()
  mocks.recordLoginAttempt.mockResolvedValue({ throttled: false })
  mocks.clearLoginAttempts.mockClear()
  mocks.compare.mockReset()
  mocks.compare.mockResolvedValue(true)
  mocks.hash.mockClear()
  mocks.signIn.mockReset()
  mocks.signIn.mockImplementation(async (_provider, options) => {
    throw new mocks.Redirect(String(options.redirectTo))
  })
})

describe('changePassword', () => {
  it('checks the session before anything else', async () => {
    mocks.requireAdmin.mockRejectedValueOnce(new mocks.Redirect('/login'))
    expect(await redirectOf(changePassword(form()))).toBe('/login')
    expect(mocks.recordLoginAttempt).not.toHaveBeenCalled()
  })

  it('rejects invalid input before touching the database', async () => {
    expect(await redirectOf(changePassword(form({ confirmPassword: 'something else 1' })))).toBe(
      '/admin/account?error=mismatch',
    )
    expect(await redirectOf(changePassword(form({ newPassword: CURRENT, confirmPassword: CURRENT })))).toBe(
      '/admin/account?error=same',
    )
    expect(mocks.recordLoginAttempt).not.toHaveBeenCalled()
  })

  it('refuses when throttled without checking the password', async () => {
    mocks.recordLoginAttempt.mockResolvedValueOnce({ throttled: true })
    expect(await redirectOf(changePassword(form()))).toBe('/admin/account?error=throttled')
    expect(mocks.compare).not.toHaveBeenCalled()
    expect(mocks.state.updates).toEqual([])
  })

  it('records a wrong current password as a failed attempt and changes nothing', async () => {
    mocks.compare.mockResolvedValueOnce(false)
    expect(await redirectOf(changePassword(form()))).toBe('/admin/account?error=current')
    expect(mocks.recordLoginAttempt).toHaveBeenCalledWith('ana@example.com', '203.0.113.9')
    expect(mocks.compare).toHaveBeenCalledWith(CURRENT, '$2b$12$stored')
    expect(mocks.state.updates).toEqual([])
    expect(mocks.clearLoginAttempts).not.toHaveBeenCalled()
  })

  it('stores a cost-12 hash, stamps the change from the app clock and clears attempts', async () => {
    const before = Date.now()
    expect(await redirectOf(changePassword(form()))).toBe('/admin/account?saved=1')
    expect(mocks.hash).toHaveBeenCalledWith(NEW, 12)
    expect(mocks.state.updates).toHaveLength(1)
    const [update] = mocks.state.updates
    expect(update.passwordHash).toBe('$2b$12$new-hash')
    expect(update.passwordChangedAt).toBeInstanceOf(Date)
    expect((update.passwordChangedAt as Date).getTime()).toBeGreaterThanOrEqual(before)
    expect(mocks.clearLoginAttempts).toHaveBeenCalledWith('ana@example.com')
  })

  it('re-issues the session with the new password so this device stays signed in', async () => {
    await redirectOf(changePassword(form()))
    expect(mocks.signIn).toHaveBeenCalledWith('credentials', {
      email: 'ana@example.com',
      password: NEW,
      redirectTo: '/admin/account?saved=1',
    })
  })

  it('sends the admin to sign in again when the re-issue fails after the change', async () => {
    mocks.signIn.mockRejectedValueOnce(Object.assign(new Error('CredentialsSignin'), { type: 'CredentialsSignin' }))
    expect(await redirectOf(changePassword(form()))).toBe('/login?changed=1')
    expect(mocks.state.updates).toHaveLength(1)
  })

  it('sends a session whose account is gone back to /login', async () => {
    mocks.state.row = null
    expect(await redirectOf(changePassword(form()))).toBe('/login')
    expect(mocks.recordLoginAttempt).not.toHaveBeenCalled()
  })

  it('never puts a password in a redirect', async () => {
    const urls = [
      await redirectOf(changePassword(form({ confirmPassword: 'something else 1' }))),
      await redirectOf(changePassword(form())),
    ]
    mocks.compare.mockResolvedValueOnce(false)
    urls.push(await redirectOf(changePassword(form())))
    for (const url of urls) {
      expect(url).not.toContain(CURRENT)
      expect(url).not.toContain(NEW)
      expect(url).not.toContain(encodeURIComponent(NEW))
    }
  })
})
