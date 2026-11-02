import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const jar = vi.hoisted(() => ({
  values: new Map<string, string>(),
  set: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.values.has(name) ? { name, value: jar.values.get(name)! } : undefined),
    set: jar.set,
  }),
}))

import {
  KNOWN_DEVICE_COOKIE,
  KNOWN_DEVICE_MAX_ACCOUNTS,
  KNOWN_DEVICE_MAX_AGE_SECONDS,
  isKnownDevice,
  rememberKnownDevice,
  withKnownDevice,
} from './known-device'

beforeEach(() => {
  vi.stubEnv('AUTH_SECRET', 'a test secret for known devices')
  jar.values.clear()
  jar.set.mockClear()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('known-device cookie', () => {
  it('recognises the account it was set for, in any letter case, and no other', () => {
    const cookie = withKnownDevice(undefined, 'ana@example.com')!
    expect(isKnownDevice(cookie, 'ana@example.com')).toBe(true)
    expect(isKnownDevice(cookie, 'ANA@example.com')).toBe(true)
    expect(isKnownDevice(cookie, 'max@example.com')).toBe(false)
  })

  it('holds no email address', () => {
    const cookie = withKnownDevice(undefined, 'ana@example.com')!
    expect(cookie).not.toMatch(/ana|example/i)
    expect(cookie).toMatch(/^[\w-]{43}$/)
  })

  it('is worthless when signed with another secret, tampered with or made up', () => {
    const cookie = withKnownDevice(undefined, 'ana@example.com')!
    vi.stubEnv('AUTH_SECRET', 'a different secret')
    expect(isKnownDevice(cookie, 'ana@example.com')).toBe(false)
    vi.stubEnv('AUTH_SECRET', 'a test secret for known devices')
    const flipped = `${cookie.slice(0, 10)}${cookie[10] === 'A' ? 'B' : 'A'}${cookie.slice(11)}`
    for (const forged of [flipped, cookie.slice(0, -1), `${cookie}A`, '', 'ana@example.com', '.'.repeat(5)]) {
      expect(isKnownDevice(forged, 'ana@example.com')).toBe(false)
    }
  })

  it('means nothing without AUTH_SECRET', () => {
    const cookie = withKnownDevice(undefined, 'ana@example.com')!
    vi.stubEnv('AUTH_SECRET', '')
    expect(isKnownDevice(cookie, 'ana@example.com')).toBe(false)
    expect(withKnownDevice(undefined, 'ana@example.com')).toBeNull()
  })

  it('remembers several accounts on one browser, dropping the least recent past the limit', () => {
    const emails = Array.from({ length: KNOWN_DEVICE_MAX_ACCOUNTS + 1 }, (_, n) => `person${n}@example.com`)
    const cookie = emails.reduce<string | undefined>((value, email) => withKnownDevice(value, email)!, undefined)!
    expect(isKnownDevice(cookie, emails[0])).toBe(false)
    for (const email of emails.slice(1)) expect(isKnownDevice(cookie, email)).toBe(true)
    expect(withKnownDevice(cookie, emails[3])!.split('.')).toHaveLength(KNOWN_DEVICE_MAX_ACCOUNTS)
  })

  it('sets an HttpOnly, Secure, SameSite=Lax cookie that lasts 180 days', async () => {
    jar.values.set(KNOWN_DEVICE_COOKIE, withKnownDevice(undefined, 'max@example.com')!)
    await rememberKnownDevice('ana@example.com')
    expect(jar.set).toHaveBeenCalledWith(KNOWN_DEVICE_COOKIE, expect.any(String), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: KNOWN_DEVICE_MAX_AGE_SECONDS,
    })
    const value = jar.set.mock.calls[0][1] as string
    expect(isKnownDevice(value, 'ana@example.com')).toBe(true)
    expect(isKnownDevice(value, 'max@example.com')).toBe(true)
    expect(KNOWN_DEVICE_MAX_AGE_SECONDS).toBe(180 * 24 * 60 * 60)
  })
})
