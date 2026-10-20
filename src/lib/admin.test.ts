import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => {
  const state = { rows: [] as { role: 'admin' | 'master'; email: string }[] }
  const limit = vi.fn(async () => state.rows)
  const query = { from: () => query, where: () => query, limit }
  return {
    state,
    limit,
    select: vi.fn(() => query),
    auth: vi.fn(),
    redirect: vi.fn((url: string) => {
      throw new Error(`REDIRECT ${url}`)
    }),
  }
})

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/db', () => ({ getDb: () => ({ select: mocks.select }) }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))

import { currentAdmin, currentSession, requireAdmin, requireMaster } from './admin'

const adminSession = { user: { id: '2', name: 'Ana', email: 'ana@example.com', role: 'admin' }, expires: '' }
const masterSession = { user: { id: '1', name: 'Max', email: 'max@example.com', role: 'master' }, expires: '' }
const configErrorResponse = {
  message: 'There was a problem with the server configuration. Check the server logs for more information.',
}

beforeEach(() => {
  mocks.auth.mockReset()
  mocks.select.mockClear()
  mocks.limit.mockClear()
  mocks.redirect.mockClear()
  mocks.state.rows = []
})

describe('currentSession', () => {
  it('returns the session for a signed-in user', async () => {
    mocks.auth.mockResolvedValue(adminSession)
    await expect(currentSession()).resolves.toBe(adminSession)
  })

  it('treats a missing session as signed out', async () => {
    mocks.auth.mockResolvedValue(null)
    await expect(currentSession()).resolves.toBeNull()
  })

  it('treats an auth configuration error as signed out', async () => {
    mocks.auth.mockResolvedValue(configErrorResponse)
    await expect(currentSession()).resolves.toBeNull()
  })
})

describe('currentAdmin', () => {
  it('returns null without querying when signed out or misconfigured', async () => {
    mocks.auth.mockResolvedValue(configErrorResponse)
    await expect(currentAdmin()).resolves.toBeNull()
    mocks.auth.mockResolvedValue(null)
    await expect(currentAdmin()).resolves.toBeNull()
    expect(mocks.select).not.toHaveBeenCalled()
  })

  it('returns null without querying for an invalid session id or missing email', async () => {
    for (const id of ['abc', '0', '2147483648']) {
      mocks.auth.mockResolvedValue({ ...adminSession, user: { ...adminSession.user, id } })
      await expect(currentAdmin()).resolves.toBeNull()
    }
    mocks.auth.mockResolvedValue({ ...adminSession, user: { ...adminSession.user, email: undefined } })
    await expect(currentAdmin()).resolves.toBeNull()
    expect(mocks.select).not.toHaveBeenCalled()
  })

  it('returns null once the admin row is deleted', async () => {
    mocks.auth.mockResolvedValue(adminSession)
    await expect(currentAdmin()).resolves.toBeNull()
    expect(mocks.limit).toHaveBeenCalledTimes(1)
  })

  it('returns null when the id now belongs to a different admin', async () => {
    mocks.auth.mockResolvedValue(adminSession)
    mocks.state.rows = [{ role: 'master', email: 'someone-else@example.com' }]
    await expect(currentAdmin()).resolves.toBeNull()
  })

  it('takes the role from the database row', async () => {
    mocks.auth.mockResolvedValue(masterSession)
    mocks.state.rows = [{ role: 'admin', email: 'max@example.com' }]
    const admin = await currentAdmin()
    expect(admin?.user.role).toBe('admin')
    expect(admin?.user.name).toBe('Max')
  })
})

describe('requireAdmin', () => {
  it('redirects to /login when auth is misconfigured instead of failing open', async () => {
    mocks.auth.mockResolvedValue(configErrorResponse)
    await expect(requireAdmin()).rejects.toThrow('REDIRECT /login')
  })

  it('redirects a deleted admin with a still-valid token to /login', async () => {
    mocks.auth.mockResolvedValue(adminSession)
    await expect(requireAdmin()).rejects.toThrow('REDIRECT /login')
  })

  it('returns the session for an existing admin', async () => {
    mocks.auth.mockResolvedValue(adminSession)
    mocks.state.rows = [{ role: 'admin', email: 'ana@example.com' }]
    await expect(requireAdmin()).resolves.toMatchObject({ user: { id: '2', role: 'admin' } })
  })
})

describe('requireMaster', () => {
  it('sends regular admins back to the dashboard', async () => {
    mocks.auth.mockResolvedValue(adminSession)
    mocks.state.rows = [{ role: 'admin', email: 'ana@example.com' }]
    await expect(requireMaster()).rejects.toThrow('REDIRECT /admin')
  })

  it('uses the database role over a stale master token', async () => {
    mocks.auth.mockResolvedValue(masterSession)
    mocks.state.rows = [{ role: 'admin', email: 'max@example.com' }]
    await expect(requireMaster()).rejects.toThrow('REDIRECT /admin')
  })

  it('returns the session for a master', async () => {
    mocks.auth.mockResolvedValue(masterSession)
    mocks.state.rows = [{ role: 'master', email: 'max@example.com' }]
    await expect(requireMaster()).resolves.toMatchObject({ user: { id: '1', role: 'master' } })
  })
})
