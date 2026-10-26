import { beforeEach, describe, expect, it, vi } from 'vitest'

type Caller = { id: string; role: 'admin' | 'master'; canCreateAccounts: boolean }

const mocks = vi.hoisted(() => {
  class Redirect extends Error {
    constructor(readonly url: string) {
      super(`REDIRECT ${url}`)
    }
  }
  const state = {
    caller: null as Caller | null,
    target: { role: 'admin' } as { role: 'admin' | 'master' } | null,
    member: null as { id: number } | null,
    inserted: [{ id: 9 }] as { id: number }[],
    deleted: [{ id: 4 }] as { id: number }[],
    updated: [{ id: 4, email: 'ana@example.com' }] as { id: number; email: string }[],
    inserts: [] as Record<string, unknown>[],
    deletes: 0,
    updates: [] as Record<string, unknown>[],
  }
  const select = () => {
    let table = ''
    const query = {
      from: (source: Record<symbol, string>) => {
        table = source[Symbol.for('drizzle:Name')]
        return query
      },
      where: () => query,
      limit: async () => {
        if (table === 'members') return state.member ? [state.member] : []
        return state.target ? [state.target] : []
      },
    }
    return query
  }
  return {
    Redirect,
    state,
    db: {
      select,
      insert: () => ({
        values: (values: Record<string, unknown>) => ({
          onConflictDoNothing: () => ({
            returning: async () => {
              state.inserts.push(values)
              return state.inserted
            },
          }),
        }),
      }),
      delete: () => ({
        where: () => ({
          returning: async () => {
            state.deletes += 1
            return state.deleted
          },
        }),
      }),
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
    requireMaster: vi.fn(),
    requireAccountCreator: vi.fn(),
    clearLoginAttempts: vi.fn(async () => {}),
    hash: vi.fn(async (_password: string, cost: number) => `$2b$${cost}$hash`),
  }
})

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new mocks.Redirect(url)
  },
}))
vi.mock('@/db', () => ({ getDb: () => mocks.db }))
vi.mock('@/lib/authorize', () => ({ clearLoginAttempts: mocks.clearLoginAttempts }))
vi.mock('bcryptjs', () => ({ default: { hash: mocks.hash } }))
vi.mock('@/lib/admin', async () => {
  const { mayCreateAccounts } = await import('@/lib/admin-account')
  const guard = (allowed: (caller: Caller) => boolean) => async () => {
    const caller = mocks.state.caller
    if (!caller) throw new mocks.Redirect('/login')
    if (!allowed(caller)) throw new mocks.Redirect('/admin')
    return { user: { ...caller, email: `${caller.id}@example.com` } }
  }
  mocks.requireMaster.mockImplementation(guard((caller) => caller.role === 'master'))
  mocks.requireAccountCreator.mockImplementation(guard(mayCreateAccounts))
  return { requireMaster: mocks.requireMaster, requireAccountCreator: mocks.requireAccountCreator }
})

import { createAdmin, deleteAdmin, resetAdminPassword, setCanCreateAccounts } from './actions'

const master: Caller = { id: '1', role: 'master', canCreateAccounts: false }
const elevated: Caller = { id: '2', role: 'admin', canCreateAccounts: true }
const plain: Caller = { id: '3', role: 'admin', canCreateAccounts: false }

const NEW = 'reset password 789'

function form(fields: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

const resetForm = (overrides: Record<string, string> = {}) =>
  form({ newPassword: NEW, confirmPassword: NEW, ...overrides })

const accountForm = (overrides: Record<string, string> = {}) =>
  form({ name: 'Bea Builder', email: 'Bea@Example.com', password: 'new account pw 1', ...overrides })

async function redirectOf(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    if (error instanceof mocks.Redirect) return error.url
    throw error
  }
  throw new Error('expected a redirect')
}

function expectNoWrites() {
  expect(mocks.state.inserts).toEqual([])
  expect(mocks.state.deletes).toBe(0)
  expect(mocks.state.updates).toEqual([])
}

beforeEach(() => {
  mocks.state.caller = master
  mocks.state.target = { role: 'admin' }
  mocks.state.member = null
  mocks.state.inserted = [{ id: 9 }]
  mocks.state.deleted = [{ id: 4 }]
  mocks.state.updated = [{ id: 4, email: 'ana@example.com' }]
  mocks.state.inserts = []
  mocks.state.deletes = 0
  mocks.state.updates = []
  mocks.requireMaster.mockClear()
  mocks.requireAccountCreator.mockClear()
  mocks.clearLoginAttempts.mockClear()
  mocks.hash.mockClear()
})

describe('createAdmin', () => {
  beforeEach(() => {
    mocks.state.target = null
  })

  it('checks the account creator guard', async () => {
    await redirectOf(createAdmin(accountForm()))
    expect(mocks.requireAccountCreator).toHaveBeenCalledTimes(1)
  })

  it('lets the master create a regular admin', async () => {
    expect(await redirectOf(createAdmin(accountForm()))).toBe('/admin/admins?saved=1')
    expect(mocks.state.inserts).toEqual([
      {
        name: 'Bea Builder',
        email: 'bea@example.com',
        passwordHash: '$2b$12$hash',
        role: 'admin',
        canCreateAccounts: false,
        createdBy: 1,
      },
    ])
  })

  it('lets an elevated admin create a regular admin without the permission', async () => {
    mocks.state.caller = elevated
    expect(await redirectOf(createAdmin(accountForm()))).toBe('/admin/admins?saved=1')
    expect(mocks.state.inserts).toHaveLength(1)
    expect(mocks.state.inserts[0]).toMatchObject({ role: 'admin', canCreateAccounts: false, createdBy: 2 })
  })

  it('ignores role and permission fields smuggled into the form', async () => {
    mocks.state.caller = elevated
    await redirectOf(createAdmin(accountForm({ role: 'master', canCreateAccounts: 'true', createdBy: '1' })))
    expect(mocks.state.inserts[0]).toMatchObject({ role: 'admin', canCreateAccounts: false, createdBy: 2 })
  })

  it('refuses a plain admin', async () => {
    mocks.state.caller = plain
    expect(await redirectOf(createAdmin(accountForm()))).toBe('/admin')
    expect(mocks.hash).not.toHaveBeenCalled()
    expectNoWrites()
  })

  it('sends a signed-out caller to /login', async () => {
    mocks.state.caller = null
    expect(await redirectOf(createAdmin(accountForm()))).toBe('/login')
    expectNoWrites()
  })

  it('reports an existing email as a duplicate', async () => {
    mocks.state.target = { role: 'admin' }
    expect(await redirectOf(createAdmin(accountForm()))).toBe('/admin/admins?error=duplicate')
    expectNoWrites()
  })

  it('refuses an email that belongs to a member, which would lock that member out', async () => {
    mocks.state.member = { id: 7 }
    expect(await redirectOf(createAdmin(accountForm()))).toBe('/admin/admins?error=duplicate')
    expect(mocks.hash).not.toHaveBeenCalled()
    expectNoWrites()
  })
})

describe('deleteAdmin', () => {
  it('checks the master guard', async () => {
    await redirectOf(deleteAdmin(4))
    expect(mocks.requireMaster).toHaveBeenCalledTimes(1)
    expect(mocks.requireAccountCreator).not.toHaveBeenCalled()
  })

  it('lets the master delete a regular admin', async () => {
    expect(await redirectOf(deleteAdmin(4))).toBe('/admin/admins?saved=1')
    expect(mocks.state.deletes).toBe(1)
  })

  it('refuses an elevated admin', async () => {
    mocks.state.caller = elevated
    expect(await redirectOf(deleteAdmin(4))).toBe('/admin')
    expectNoWrites()
  })

  it('refuses a plain admin', async () => {
    mocks.state.caller = plain
    expect(await redirectOf(deleteAdmin(4))).toBe('/admin')
    expectNoWrites()
  })

  it('refuses to delete the signed-in master', async () => {
    expect(await redirectOf(deleteAdmin(1))).toBe('/admin/admins?error=self')
    expectNoWrites()
  })

  it('reports a master target as protected', async () => {
    mocks.state.deleted = []
    mocks.state.target = { role: 'master' }
    expect(await redirectOf(deleteAdmin(5))).toBe('/admin/admins?error=master')
  })
})

describe('resetAdminPassword', () => {
  it('checks the master guard', async () => {
    await redirectOf(resetAdminPassword(4, resetForm()))
    expect(mocks.requireMaster).toHaveBeenCalledTimes(1)
    expect(mocks.requireAccountCreator).not.toHaveBeenCalled()
  })

  it('refuses an elevated admin', async () => {
    mocks.state.caller = elevated
    expect(await redirectOf(resetAdminPassword(4, resetForm()))).toBe('/admin')
    expect(mocks.hash).not.toHaveBeenCalled()
    expectNoWrites()
  })

  it('refuses a plain admin', async () => {
    mocks.state.caller = plain
    expect(await redirectOf(resetAdminPassword(4, resetForm()))).toBe('/admin')
    expect(mocks.hash).not.toHaveBeenCalled()
    expectNoWrites()
  })

  it('refuses to reset the signed-in master', async () => {
    expect(await redirectOf(resetAdminPassword(1, resetForm()))).toBe('/admin/admins?error=self')
    expectNoWrites()
  })

  it('refuses master accounts', async () => {
    mocks.state.target = { role: 'master' }
    expect(await redirectOf(resetAdminPassword(5, resetForm()))).toBe('/admin/admins?error=master')
    expectNoWrites()
  })

  it('reports unknown and out-of-range ids as missing', async () => {
    mocks.state.target = null
    expect(await redirectOf(resetAdminPassword(99, resetForm()))).toBe('/admin/admins?error=missing')
    expect(await redirectOf(resetAdminPassword(0, resetForm()))).toBe('/admin/admins?error=missing')
    expectNoWrites()
  })

  it('reports an admin removed or promoted between the check and the update as missing', async () => {
    mocks.state.updated = []
    expect(await redirectOf(resetAdminPassword(4, resetForm()))).toBe('/admin/admins?error=missing')
    expect(mocks.clearLoginAttempts).not.toHaveBeenCalled()
  })

  it('validates the new password and its confirmation', async () => {
    expect(await redirectOf(resetAdminPassword(4, resetForm({ confirmPassword: 'reset password 780' })))).toBe(
      '/admin/admins?error=mismatch',
    )
    expect(
      await redirectOf(resetAdminPassword(4, resetForm({ newPassword: 'short', confirmPassword: 'short' }))),
    ).toBe('/admin/admins?error=password')
    expectNoWrites()
  })

  it('stores a cost-12 hash, ends their sessions and clears their attempts', async () => {
    const before = Date.now()
    const url = await redirectOf(resetAdminPassword(4, resetForm()))
    expect(url).toBe('/admin/admins?saved=reset')
    expect(url).not.toContain(NEW)
    expect(mocks.hash).toHaveBeenCalledWith(NEW, 12)
    const [update] = mocks.state.updates
    expect(update.passwordHash).toBe('$2b$12$hash')
    expect((update.passwordChangedAt as Date).getTime()).toBeGreaterThanOrEqual(before)
    expect(mocks.clearLoginAttempts).toHaveBeenCalledWith('ana@example.com')
  })
})

describe('setCanCreateAccounts', () => {
  it('checks the master guard', async () => {
    await redirectOf(setCanCreateAccounts(4, true))
    expect(mocks.requireMaster).toHaveBeenCalledTimes(1)
    expect(mocks.requireAccountCreator).not.toHaveBeenCalled()
  })

  it('lets the master grant and revoke the permission', async () => {
    expect(await redirectOf(setCanCreateAccounts(4, true))).toBe('/admin/admins?saved=1')
    expect(await redirectOf(setCanCreateAccounts(4, false))).toBe('/admin/admins?saved=1')
    expect(mocks.state.updates).toEqual([{ canCreateAccounts: true }, { canCreateAccounts: false }])
  })

  it('refuses an elevated admin, including on their own account', async () => {
    mocks.state.caller = elevated
    expect(await redirectOf(setCanCreateAccounts(4, true))).toBe('/admin')
    expect(await redirectOf(setCanCreateAccounts(2, false))).toBe('/admin')
    expectNoWrites()
  })

  it('refuses a plain admin, including on their own account', async () => {
    mocks.state.caller = plain
    expect(await redirectOf(setCanCreateAccounts(4, true))).toBe('/admin')
    expect(await redirectOf(setCanCreateAccounts(3, true))).toBe('/admin')
    expectNoWrites()
  })

  it('refuses to change the signed-in master', async () => {
    expect(await redirectOf(setCanCreateAccounts(1, true))).toBe('/admin/admins?error=self')
    expectNoWrites()
  })

  it('refuses master accounts', async () => {
    mocks.state.target = { role: 'master' }
    expect(await redirectOf(setCanCreateAccounts(5, true))).toBe('/admin/admins?error=master')
    expectNoWrites()
  })

  it('reports an unknown account as missing', async () => {
    mocks.state.target = null
    expect(await redirectOf(setCanCreateAccounts(99, true))).toBe('/admin/admins?error=missing')
    expectNoWrites()
  })

  it('reports an admin removed or promoted between the check and the update as missing', async () => {
    mocks.state.updated = []
    expect(await redirectOf(setCanCreateAccounts(4, true))).toBe('/admin/admins?error=missing')
  })

  it('rejects tampered arguments without writing', async () => {
    for (const [id, enabled] of [
      [0, true],
      [2_147_483_648, true],
      [1.5, true],
      [4, 'true'],
      [4, 1],
    ] as [number, boolean][]) {
      expect(await redirectOf(setCanCreateAccounts(id, enabled))).toBe('/admin/admins')
    }
    expectNoWrites()
  })
})
