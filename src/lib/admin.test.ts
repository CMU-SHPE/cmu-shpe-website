import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
}))

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))

import { currentSession, requireAdmin, requireMaster } from './admin'

const adminSession = { user: { id: '2', name: 'Ana', email: 'ana@example.com', role: 'admin' }, expires: '' }
const masterSession = { user: { id: '1', name: 'Max', email: 'max@example.com', role: 'master' }, expires: '' }
const configErrorResponse = {
  message: 'There was a problem with the server configuration. Check the server logs for more information.',
}

beforeEach(() => {
  mocks.auth.mockReset()
  mocks.redirect.mockClear()
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

describe('requireAdmin', () => {
  it('redirects to /login when auth is misconfigured instead of failing open', async () => {
    mocks.auth.mockResolvedValue(configErrorResponse)
    await expect(requireAdmin()).rejects.toThrow('REDIRECT /login')
  })

  it('returns the session for an admin', async () => {
    mocks.auth.mockResolvedValue(adminSession)
    await expect(requireAdmin()).resolves.toBe(adminSession)
  })
})

describe('requireMaster', () => {
  it('sends regular admins back to the dashboard', async () => {
    mocks.auth.mockResolvedValue(adminSession)
    await expect(requireMaster()).rejects.toThrow('REDIRECT /admin')
  })

  it('returns the session for a master', async () => {
    mocks.auth.mockResolvedValue(masterSession)
    await expect(requireMaster()).resolves.toBe(masterSession)
  })
})
