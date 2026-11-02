import { eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn<(message: { to: string; text: string }) => Promise<void>>(async () => {}),
  beforeNextBatch: null as null | (() => Promise<unknown>),
}))

vi.mock('@/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/db')>()
  return {
    ...actual,
    getDb: () =>
      new Proxy(actual.getDb(), {
        get(target, property, receiver) {
          if (property !== 'batch') return Reflect.get(target, property, receiver)
          return async (statements: Parameters<typeof target.batch>[0]) => {
            const landing = mocks.beforeNextBatch
            mocks.beforeNextBatch = null
            await landing?.()
            return target.batch(statements)
          }
        },
      }),
  }
})
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.7' }) }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`)
  },
}))
vi.mock('@/lib/email', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email')>()),
  sendEmail: mocks.sendEmail,
}))
vi.mock('@/lib/site-url', () => ({ siteUrl: () => 'https://shpe.test' }))
vi.mock('@/lib/queries', () => ({ getPrivacyPolicyVersion: async () => 'October 2026' }))

import { getDb } from '@/db'
import { memberTokens, members } from '@/db/schema'
import { createMember, resetDb } from '@/test/db'
import { signUp } from './actions'

function signUpForm(email: string) {
  const form = new FormData()
  form.set('name', 'Newcomer')
  form.set('email', email)
  form.set('password', 'a different password here')
  form.set('confirmPassword', 'a different password here')
  form.set('ageConfirmed', 'on')
  form.set('termsAccepted', 'on')
  return form
}

const sentText = () => mocks.sendEmail.mock.calls[0][0].text

async function memberState(id: number) {
  const db = getDb()
  const [[row], tokens] = await Promise.all([
    db.select({ name: members.name, passwordHash: members.passwordHash }).from(members).where(eq(members.id, id)),
    db.select({ purpose: memberTokens.purpose }).from(memberTokens).where(eq(memberTokens.memberId, id)),
  ])
  return { ...row, tokens }
}

beforeEach(async () => {
  vi.clearAllMocks()
  mocks.beforeNextBatch = null
  await resetDb()
})

describe('signUp for an unconfirmed address', () => {
  it('replaces the details and leaves only one fresh confirmation link', async () => {
    const member = await createMember({ confirmed: false, name: 'Stored Name' })
    const before = await memberState(member.id)

    await expect(signUp({}, signUpForm(member.email))).rejects.toThrow('REDIRECT /join/check-email')

    const after = await memberState(member.id)
    expect(after.name).toBe('Newcomer')
    expect(after.passwordHash).not.toBe(before.passwordHash)
    expect(after.tokens).toEqual([{ purpose: 'confirm_email' }])
    expect(sentText()).toContain('/join/confirm?token=')
  })

  it('sends the account-exists email and no link when the member confirms after the lookup', async () => {
    const member = await createMember({ confirmed: false, name: 'Stored Name' })
    const before = await memberState(member.id)
    mocks.beforeNextBatch = () =>
      getDb().update(members).set({ emailConfirmedAt: sql`now()` }).where(eq(members.id, member.id))

    await expect(signUp({}, signUpForm(member.email))).rejects.toThrow('REDIRECT /join/check-email')

    expect(mocks.beforeNextBatch).toBeNull()
    expect(await memberState(member.id)).toEqual({ ...before, tokens: [] })
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
    expect(sentText()).toContain('Hi Stored Name,')
    expect(sentText()).toContain('https://shpe.test/forgot-password')
    expect(sentText()).not.toContain('/join/confirm?token=')
  })
})
