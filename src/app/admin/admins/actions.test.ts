import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  class Redirect extends Error {
    constructor(readonly url: string) {
      super(`REDIRECT ${url}`)
    }
  }
  const state = {
    target: { role: 'admin' } as { role: 'admin' | 'master' } | null,
    updated: [{ email: 'ana@example.com' }] as { email: string }[],
    updates: [] as Record<string, unknown>[],
  }
  const selectQuery = {
    from: () => selectQuery,
    where: () => selectQuery,
    limit: async () => (state.target ? [state.target] : []),
  }
  return {
    Redirect,
    state,
    db: {
      select: () => selectQuery,
      update: () => ({
        set: (values: Record<string, unknown>) => ({
          where: () => ({
            returning: async () => {
              state.updates.push(values)
              return state.updated
            },
          }),
        }),
      }),
    },
    requireMaster: vi.fn(async () => ({ user: { id: '1', email: 'max@example.com', role: 'master' } })),
    clearLoginAttempts: vi.fn(async () => {}),
    hash: vi.fn(async (_password: string, cost: number) => `$2b$${cost}$reset-hash`),
  }
})

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new mocks.Redirect(url)
  },
}))
vi.mock('@/db', () => ({ getDb: () => mocks.db }))
vi.mock('@/lib/admin', () => ({ requireMaster: mocks.requireMaster }))
vi.mock('@/lib/authorize', () => ({ clearLoginAttempts: mocks.clearLoginAttempts }))
vi.mock('bcryptjs', () => ({ default: { hash: mocks.hash } }))

import { resetAdminPassword } from './actions'

const NEW = 'reset password 789'

function form(overrides: Record<string, string> = {}) {
  const data = new FormData()
  for (const [key, value] of Object.entries({ newPassword: NEW, confirmPassword: NEW, ...overrides })) {
    data.set(key, value)
  }
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
  mocks.state.target = { role: 'admin' }
  mocks.state.updated = [{ email: 'ana@example.com' }]
  mocks.state.updates = []
  mocks.requireMaster.mockClear()
  mocks.clearLoginAttempts.mockClear()
  mocks.hash.mockClear()
})

describe('resetAdminPassword', () => {
  it('refuses callers who are not the master', async () => {
    mocks.requireMaster.mockRejectedValueOnce(new mocks.Redirect('/admin'))
    expect(await redirectOf(resetAdminPassword(2, form()))).toBe('/admin')
    expect(mocks.hash).not.toHaveBeenCalled()
    expect(mocks.state.updates).toEqual([])
  })

  it('refuses to reset the signed-in master', async () => {
    expect(await redirectOf(resetAdminPassword(1, form()))).toBe('/admin/admins?error=self')
    expect(mocks.state.updates).toEqual([])
  })

  it('refuses master accounts', async () => {
    mocks.state.target = { role: 'master' }
    expect(await redirectOf(resetAdminPassword(3, form()))).toBe('/admin/admins?error=master')
    expect(mocks.state.updates).toEqual([])
  })

  it('reports unknown and out-of-range ids as missing', async () => {
    mocks.state.target = null
    expect(await redirectOf(resetAdminPassword(99, form()))).toBe('/admin/admins?error=missing')
    expect(await redirectOf(resetAdminPassword(0, form()))).toBe('/admin/admins?error=missing')
    expect(mocks.state.updates).toEqual([])
  })

  it('reports an admin removed or promoted between the check and the update as missing', async () => {
    mocks.state.updated = []
    expect(await redirectOf(resetAdminPassword(2, form()))).toBe('/admin/admins?error=missing')
    expect(mocks.clearLoginAttempts).not.toHaveBeenCalled()
  })

  it('validates the new password and its confirmation', async () => {
    expect(await redirectOf(resetAdminPassword(2, form({ confirmPassword: 'reset password 780' })))).toBe(
      '/admin/admins?error=mismatch',
    )
    expect(await redirectOf(resetAdminPassword(2, form({ newPassword: 'short', confirmPassword: 'short' })))).toBe(
      '/admin/admins?error=password',
    )
    expect(mocks.state.updates).toEqual([])
  })

  it('stores a cost-12 hash, ends their sessions and clears their attempts', async () => {
    const before = Date.now()
    const url = await redirectOf(resetAdminPassword(2, form()))
    expect(url).toBe('/admin/admins?saved=reset')
    expect(url).not.toContain(NEW)
    expect(mocks.hash).toHaveBeenCalledWith(NEW, 12)
    const [update] = mocks.state.updates
    expect(update.passwordHash).toBe('$2b$12$reset-hash')
    expect((update.passwordChangedAt as Date).getTime()).toBeGreaterThanOrEqual(before)
    expect(mocks.clearLoginAttempts).toHaveBeenCalledWith('ana@example.com')
  })
})
