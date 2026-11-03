import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { getDb } from '@/db'
import { admins, members } from '@/db/schema'

export const KNOWN_DEVICE_COOKIE = '__Host-known_device'
export const KNOWN_DEVICE_MAX_ACCOUNTS = 5
export const KNOWN_DEVICE_MAX_AGE_SECONDS = 180 * 24 * 60 * 60

const MAC_CONTEXT = 'known-device:v2'
const BROWSER_ID = /^[\w-]{22}$/
const ISSUED_AT = /^[0-9a-z]{1,12}$/
const MAC = /^[\w-]{43}$/

export type DeviceAccount = {
  kind: 'admin' | 'member'
  id: number
  email: string
  passwordChangedAt: Date | null
}

type Entry = { browserId: string; issuedAt: number; mac: string }

/** Stands in for an unknown email, so checking a cookie takes as long whether or not the account exists. */
const NO_ACCOUNT: DeviceAccount = { kind: 'member', id: 0, email: '', passwordChangedAt: null }

function secret(): string | null {
  return process.env.AUTH_SECRET?.trim() || null
}

/**
 * Bound to the account row and its current password, so a password change or reset revokes every
 * copy of the cookie, stolen ones included, and a later account reusing the address gets nothing.
 */
function macFor(key: string, account: DeviceAccount, browserId: string, issuedAt: number): Buffer {
  const fields = [
    MAC_CONTEXT,
    account.kind,
    account.id,
    account.email.toLowerCase(),
    account.passwordChangedAt?.getTime() ?? 0,
    browserId,
    issuedAt,
  ]
  return createHmac('sha256', key).update(fields.join('\n')).digest()
}

function entriesIn(cookieValue: string | undefined): Entry[] {
  return (cookieValue ?? '')
    .split('~')
    .slice(0, KNOWN_DEVICE_MAX_ACCOUNTS)
    .flatMap((part) => {
      const [browserId, issued, mac, ...rest] = part.split('.')
      if (rest.length > 0 || !BROWSER_ID.test(browserId ?? '') || !ISSUED_AT.test(issued ?? '') || !MAC.test(mac ?? '')) {
        return []
      }
      return [{ browserId, issuedAt: parseInt(issued, 36), mac }]
    })
}

function format(entries: Entry[]): string {
  return entries.map(({ browserId, issuedAt, mac }) => `${browserId}.${issuedAt.toString(36)}.${mac}`).join('~')
}

function isLive(entry: Entry, account: DeviceAccount, now: number): boolean {
  const changedAt = account.passwordChangedAt?.getTime() ?? 0
  return entry.issuedAt <= now && now - entry.issuedAt <= KNOWN_DEVICE_MAX_AGE_SECONDS * 1000 && entry.issuedAt >= changedAt
}

function verifies(key: string, entry: Entry, account: DeviceAccount): boolean {
  return timingSafeEqual(Buffer.from(entry.mac, 'base64url'), macFor(key, account, entry.browserId, entry.issuedAt))
}

/** Every entry is checked in full, also for an unknown email, so the time taken says nothing. */
export function isKnownDevice(cookieValue: string | undefined, account: DeviceAccount | null, now = Date.now()): boolean {
  const key = secret()
  if (!key) return false
  const checked = account ?? NO_ACCOUNT
  let known = false
  for (const entry of entriesIn(cookieValue)) {
    if (verifies(key, entry, checked) && isLive(entry, checked, now)) known = true
  }
  return account !== null && known
}

/** Newest first; this account's older entry and anything expired or past the limit drop off. */
export function withKnownDevice(cookieValue: string | undefined, account: DeviceAccount, now = Date.now()): string | null {
  const key = secret()
  if (!key) return null
  const kept = entriesIn(cookieValue).filter((entry) => now - entry.issuedAt <= KNOWN_DEVICE_MAX_AGE_SECONDS * 1000)
  const browserId = kept[0]?.browserId ?? randomBytes(16).toString('base64url')
  const fresh = { browserId, issuedAt: now, mac: macFor(key, account, browserId, now).toString('base64url') }
  const others = kept.filter((entry) => !verifies(key, entry, account))
  return format([fresh, ...others].slice(0, KNOWN_DEVICE_MAX_ACCOUNTS))
}

/** An admin row wins over a member row, as at sign-in; both tables are always read. */
export async function deviceAccountFor(email: string): Promise<DeviceAccount | null> {
  const db = getDb()
  const [[admin], [member]] = await Promise.all([
    db
      .select({ id: admins.id, email: admins.email, passwordChangedAt: admins.passwordChangedAt })
      .from(admins)
      .where(eq(admins.email, email))
      .limit(1),
    db
      .select({ id: members.id, email: members.email, passwordChangedAt: members.passwordChangedAt })
      .from(members)
      .where(eq(members.email, email))
      .limit(1),
  ])
  if (admin) return { kind: 'admin', ...admin }
  if (member) return { kind: 'member', ...member }
  return null
}

export async function readKnownDevice(): Promise<string | undefined> {
  return (await cookies()).get(KNOWN_DEVICE_COOKIE)?.value
}

const COOKIE_OPTIONS = { httpOnly: true, secure: true, sameSite: 'lax', path: '/' } as const

/** Only callable where cookies can be written: a server action or route handler. */
export async function rememberKnownDevice(email: string) {
  const account = await deviceAccountFor(email.toLowerCase())
  if (!account) return
  const jar = await cookies()
  const value = withKnownDevice(jar.get(KNOWN_DEVICE_COOKIE)?.value, account)
  if (!value) return
  jar.set(KNOWN_DEVICE_COOKIE, value, { ...COOKIE_OPTIONS, maxAge: KNOWN_DEVICE_MAX_AGE_SECONDS })
}

export async function forgetKnownDevice() {
  const jar = await cookies()
  if (jar.get(KNOWN_DEVICE_COOKIE)) jar.set(KNOWN_DEVICE_COOKIE, '', { ...COOKIE_OPTIONS, maxAge: 0 })
}
