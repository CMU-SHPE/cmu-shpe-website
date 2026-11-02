import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

export const KNOWN_DEVICE_COOKIE = 'known_device'
export const KNOWN_DEVICE_MAX_ACCOUNTS = 5
export const KNOWN_DEVICE_MAX_AGE_SECONDS = 180 * 24 * 60 * 60

const TAG_CONTEXT = 'known-device:v1:'

/**
 * The cookie holds one HMAC per account that has signed in on this browser, never the email
 * itself, so it shows nothing about which accounts those are and can't be made for another one.
 */
function tagFor(email: string): Buffer | null {
  const secret = process.env.AUTH_SECRET?.trim()
  if (!secret) return null
  return createHmac('sha256', secret).update(`${TAG_CONTEXT}${email.toLowerCase()}`).digest()
}

function tagsIn(cookieValue: string | undefined): string[] {
  return (cookieValue ?? '').split('.').filter(Boolean).slice(0, KNOWN_DEVICE_MAX_ACCOUNTS)
}

export function isKnownDevice(cookieValue: string | undefined, email: string): boolean {
  const expected = tagFor(email)
  if (!expected) return false
  return tagsIn(cookieValue).some((tag) => {
    const given = Buffer.from(tag, 'base64url')
    return given.length === expected.length && timingSafeEqual(given, expected)
  })
}

/** Newest first, so the least recently used account drops off once the cookie is full. */
export function withKnownDevice(cookieValue: string | undefined, email: string): string | null {
  const tag = tagFor(email)?.toString('base64url')
  if (!tag) return null
  return [tag, ...tagsIn(cookieValue).filter((existing) => existing !== tag)].slice(0, KNOWN_DEVICE_MAX_ACCOUNTS).join('.')
}

export async function readKnownDevice(): Promise<string | undefined> {
  return (await cookies()).get(KNOWN_DEVICE_COOKIE)?.value
}

/** Only callable where cookies can be written: a server action or route handler. */
export async function rememberKnownDevice(email: string) {
  const jar = await cookies()
  const value = withKnownDevice(jar.get(KNOWN_DEVICE_COOKIE)?.value, email)
  if (!value) return
  jar.set(KNOWN_DEVICE_COOKIE, value, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: KNOWN_DEVICE_MAX_AGE_SECONDS,
  })
}
