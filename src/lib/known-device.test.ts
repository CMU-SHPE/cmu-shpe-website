import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const jar = vi.hoisted(() => ({
  values: new Map<string, string>(),
  set: vi.fn(),
  account: null as null | { kind: 'admin' | 'member'; id: number; email: string; passwordChangedAt: Date | null },
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.values.has(name) ? { name, value: jar.values.get(name)! } : undefined),
    set: jar.set,
  }),
}))
vi.mock('@/db', () => ({
  getDb: () => ({
    select: () => ({
      from: (table: Record<symbol, string>) => ({
        where: () => ({
          limit: async () => {
            const name = table[Symbol.for('drizzle:Name')]
            const account = jar.account
            return account && `${account.kind}s` === name ? [account] : []
          },
        }),
      }),
    }),
  }),
}))

import {
  KNOWN_DEVICE_COOKIE,
  KNOWN_DEVICE_MAX_ACCOUNTS,
  KNOWN_DEVICE_MAX_AGE_SECONDS,
  type DeviceAccount,
  forgetKnownDevice,
  isKnownDevice,
  rememberKnownDevice,
  withKnownDevice,
} from './known-device'

const ana: DeviceAccount = { kind: 'admin', id: 2, email: 'ana@example.com', passwordChangedAt: null }
const DAY = 24 * 60 * 60 * 1000

beforeEach(() => {
  vi.stubEnv('AUTH_SECRET', 'a test secret for known devices')
  jar.values.clear()
  jar.set.mockClear()
  jar.account = null
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('known-device codes', () => {
  it('recognise the account they were issued for, and no other account', () => {
    const cookie = withKnownDevice(undefined, ana)!
    expect(isKnownDevice(cookie, ana)).toBe(true)
    expect(isKnownDevice(cookie, { ...ana, email: 'ANA@example.com' })).toBe(true)
    expect(isKnownDevice(cookie, { ...ana, email: 'max@example.com' })).toBe(false)
    expect(isKnownDevice(cookie, { ...ana, id: 3 })).toBe(false)
    expect(isKnownDevice(cookie, { ...ana, kind: 'member' })).toBe(false)
    expect(isKnownDevice(cookie, null)).toBe(false)
  })

  it('hold no email address, and differ between browsers', () => {
    const first = withKnownDevice(undefined, ana)!
    const second = withKnownDevice(undefined, ana)!
    expect(first).not.toMatch(/ana|example/i)
    expect(first.split('.')[0]).not.toBe(second.split('.')[0])
  })

  it('stop working once the password changes, stolen copies included', () => {
    const issuedAt = Date.now()
    const cookie = withKnownDevice(undefined, ana, issuedAt)!
    const changed = { ...ana, passwordChangedAt: new Date(issuedAt + 1000) }
    expect(isKnownDevice(cookie, changed, issuedAt + 2000)).toBe(false)
  })

  it('refuse a code issued before the current password, even one signed for it', () => {
    const changedAt = new Date(Date.now())
    const account = { ...ana, passwordChangedAt: changedAt }
    const backdated = withKnownDevice(undefined, account, changedAt.getTime() - 1)!
    expect(isKnownDevice(backdated, account, changedAt.getTime() + 1)).toBe(false)
    expect(isKnownDevice(withKnownDevice(undefined, account, changedAt.getTime())!, account, changedAt.getTime() + 1)).toBe(true)
  })

  it('expire 180 days after they were issued, and refuse one dated in the future', () => {
    const issuedAt = Date.now()
    const cookie = withKnownDevice(undefined, ana, issuedAt)!
    expect(isKnownDevice(cookie, ana, issuedAt + 180 * DAY)).toBe(true)
    expect(isKnownDevice(cookie, ana, issuedAt + 180 * DAY + 1)).toBe(false)
    expect(isKnownDevice(cookie, ana, issuedAt - 1)).toBe(false)
  })

  it('are worthless when signed with another secret, tampered with or made up', () => {
    const cookie = withKnownDevice(undefined, ana)!
    vi.stubEnv('AUTH_SECRET', 'a different secret')
    expect(isKnownDevice(cookie, ana)).toBe(false)
    vi.stubEnv('AUTH_SECRET', 'a test secret for known devices')
    const [browserId, issued, mac] = cookie.split('.')
    const flip = (text: string, at: number) => `${text.slice(0, at)}${text[at] === 'A' ? 'B' : 'A'}${text.slice(at + 1)}`
    const later = (parseInt(issued, 36) + 1).toString(36)
    for (const forged of [
      `${flip(browserId, 3)}.${issued}.${mac}`,
      `${browserId}.${later}.${mac}`,
      `${browserId}.${issued}.${flip(mac, 5)}`,
      `${browserId}.${issued}.${mac}.extra`,
      cookie.slice(0, -1),
      '',
      'ana@example.com',
    ]) {
      expect(isKnownDevice(forged, ana)).toBe(false)
    }
  })

  it('mean nothing without AUTH_SECRET', () => {
    const cookie = withKnownDevice(undefined, ana)!
    vi.stubEnv('AUTH_SECRET', '')
    expect(isKnownDevice(cookie, ana)).toBe(false)
    expect(withKnownDevice(undefined, ana)).toBeNull()
  })

  it('keep one browser id for several accounts, replacing an account’s older code and dropping the least recent past the limit', () => {
    const accounts = Array.from({ length: KNOWN_DEVICE_MAX_ACCOUNTS + 1 }, (_, n) => ({ ...ana, id: n + 10 }))
    const cookie = accounts.reduce<string | undefined>((value, account) => withKnownDevice(value, account)!, undefined)!
    const entries = cookie.split('~')
    expect(entries).toHaveLength(KNOWN_DEVICE_MAX_ACCOUNTS)
    expect(new Set(entries.map((entry) => entry.split('.')[0])).size).toBe(1)
    expect(isKnownDevice(cookie, accounts[0])).toBe(false)
    for (const account of accounts.slice(1)) expect(isKnownDevice(cookie, account)).toBe(true)
    expect(withKnownDevice(cookie, accounts[3])!.split('~')).toHaveLength(KNOWN_DEVICE_MAX_ACCOUNTS)
  })
})

describe('the known-device cookie', () => {
  it('is set as an HttpOnly, Secure, SameSite=Lax __Host- cookie lasting 180 days, for the account that exists', async () => {
    jar.account = ana
    await rememberKnownDevice('Ana@Example.com')
    expect(jar.set).toHaveBeenCalledWith('__Host-known_device', expect.any(String), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: KNOWN_DEVICE_MAX_AGE_SECONDS,
    })
    expect(KNOWN_DEVICE_COOKIE).toBe('__Host-known_device')
    expect(isKnownDevice(jar.set.mock.calls[0][1] as string, ana)).toBe(true)
  })

  it('is not set for an address with no account', async () => {
    await rememberKnownDevice('nobody@example.com')
    expect(jar.set).not.toHaveBeenCalled()
  })

  it('is removed on sign-out, and left alone when there is none', async () => {
    await forgetKnownDevice()
    expect(jar.set).not.toHaveBeenCalled()
    jar.values.set(KNOWN_DEVICE_COOKIE, withKnownDevice(undefined, ana)!)
    await forgetKnownDevice()
    expect(jar.set).toHaveBeenCalledWith(KNOWN_DEVICE_COOKIE, '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
  })
})
