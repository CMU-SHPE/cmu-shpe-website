import bcrypt from 'bcryptjs'
import { and, eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn<(message: { to: string; text: string }) => Promise<void>>(async () => {}),
  beforeNextBatch: null as null | (() => Promise<unknown>),
  afterResponse: [] as (() => Promise<void>)[],
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
vi.mock('next/server', () => ({ after: (callback: () => Promise<void>) => mocks.afterResponse.push(callback) }))
vi.mock('@/lib/site-url', () => ({ siteUrl: () => 'https://shpe.test' }))
vi.mock('@/lib/queries', () => ({ getPrivacyPolicyVersion: async () => 'October 2026' }))

import { getDb } from '@/db'
import { memberTokens, members } from '@/db/schema'
import { hashToken, insertMemberToken, newMemberToken } from '@/lib/member-tokens'
import { TEST_PASSWORD, createMember, resetDb } from '@/test/db'
import { signUp } from './actions'
import { confirmMemberEmail } from './confirm/actions'
import { resendConfirmation } from './resend/actions'

const OWNER_PASSWORD = 'the owner chose this one'
const STRANGER_PASSWORD = 'a stranger chose this one'

function signUpForm(email: string, name = 'Newcomer', password = 'a different password here') {
  const form = new FormData()
  form.set('name', name)
  form.set('email', email)
  form.set('password', password)
  form.set('confirmPassword', password)
  form.set('ageConfirmed', 'on')
  form.set('termsAccepted', 'on')
  return form
}

const sentText = () => mocks.sendEmail.mock.calls[0][0].text

function lastEmailedToken() {
  const match = /\/join\/confirm\?token=([A-Za-z0-9_-]{43})/.exec(mocks.sendEmail.mock.calls.at(-1)![0].text)
  if (!match) throw new Error('no confirmation link in the last email')
  return match[1]
}

async function signUpAs(email: string, name: string, password: string) {
  await expect(signUp({}, signUpForm(email, name, password))).rejects.toThrow('REDIRECT /join/check-email')
  return lastEmailedToken()
}

async function confirm(token: string, password: string) {
  const form = new FormData()
  form.set('token', token)
  form.set('password', password)
  return confirmMemberEmail({}, form).then(
    (state) => state,
    (error: Error) => error.message,
  )
}

async function resend(email: string) {
  const form = new FormData()
  form.set('email', email)
  await expect(resendConfirmation({}, form)).rejects.toThrow('REDIRECT /join/resend?sent=1')
  for (const callback of mocks.afterResponse.splice(0)) await callback()
  return lastEmailedToken()
}

async function account(email: string) {
  const [row] = await getDb().select().from(members).where(eq(members.email, email))
  return row
}

async function confirmLinks(memberId: number) {
  return getDb()
    .select({ tokenHash: memberTokens.tokenHash })
    .from(memberTokens)
    .where(and(eq(memberTokens.memberId, memberId), eq(memberTokens.purpose, 'confirm_email')))
}

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
  mocks.afterResponse.length = 0
  await resetDb()
})

describe('signUp for an unconfirmed address', () => {
  it('leaves the details alone and adds a link of its own carrying this sign-up', async () => {
    const member = await createMember({ confirmed: false, name: 'Stored Name' })
    const before = await memberState(member.id)

    await expect(signUp({}, signUpForm(member.email))).rejects.toThrow('REDIRECT /join/check-email')

    expect(await memberState(member.id)).toEqual({ ...before, tokens: [{ purpose: 'confirm_email' }] })
    const [link] = await getDb().select().from(memberTokens).where(eq(memberTokens.memberId, member.id))
    expect(link).toMatchObject({ name: 'Newcomer', privacyPolicyVersion: 'October 2026' })
    expect(await bcrypt.compare('a different password here', link.passwordHash!)).toBe(true)
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

describe('confirmation links when a stranger signs up with the owner\'s address', () => {
  const email = 'owner@example.com'

  it('owner then stranger: the owner\'s link confirms with the owner\'s password, and the stranger\'s then fails', async () => {
    const owners = await signUpAs(email, 'Owner', OWNER_PASSWORD)
    const strangers = await signUpAs(email, 'Stranger', STRANGER_PASSWORD)
    const { id } = await account(email)
    expect(await confirmLinks(id)).toHaveLength(2)

    await expect(confirm(owners, STRANGER_PASSWORD)).resolves.toMatchObject({ formError: expect.any(String) })
    await expect(confirm(owners, OWNER_PASSWORD)).resolves.toBe('REDIRECT /login?confirmed=1')

    const confirmed = await account(email)
    expect(confirmed).toMatchObject({ name: 'Owner', emailConfirmedAt: expect.any(Date) })
    expect(await bcrypt.compare(OWNER_PASSWORD, confirmed.passwordHash)).toBe(true)
    expect(await confirmLinks(id)).toEqual([])
    await expect(confirm(strangers, STRANGER_PASSWORD)).resolves.toBe('REDIRECT /join/confirm?invalid=1')
    expect(await bcrypt.compare(OWNER_PASSWORD, (await account(email)).passwordHash)).toBe(true)
  })

  it('stranger then owner: confirming the owner\'s link records the owner\'s name, password and consent', async () => {
    const strangers = await signUpAs(email, 'Stranger', STRANGER_PASSWORD)
    const owners = await signUpAs(email, 'Owner', OWNER_PASSWORD)
    const { id } = await account(email)
    const [ownersLink] = await getDb().select().from(memberTokens).where(eq(memberTokens.tokenHash, hashToken(owners)))

    await expect(confirm(strangers, OWNER_PASSWORD)).resolves.toMatchObject({ formError: expect.any(String) })
    await expect(confirm(owners, OWNER_PASSWORD)).resolves.toBe('REDIRECT /login?confirmed=1')

    const confirmed = await account(email)
    expect(confirmed).toMatchObject({
      id,
      name: 'Owner',
      privacyPolicyVersion: 'October 2026',
      ageConfirmedAt: ownersLink.ageConfirmedAt,
      termsAcceptedAt: ownersLink.termsAcceptedAt,
    })
    expect(await bcrypt.compare(OWNER_PASSWORD, confirmed.passwordHash)).toBe(true)
    await expect(confirm(strangers, STRANGER_PASSWORD)).resolves.toBe('REDIRECT /join/confirm?invalid=1')
  })

  it('a resend after the stranger signs up leaves both links working and confirms with the owner\'s password', async () => {
    const owners = await signUpAs(email, 'Owner', OWNER_PASSWORD)
    const strangers = await signUpAs(email, 'Stranger', STRANGER_PASSWORD)
    const resent = await resend(email)
    const { id } = await account(email)
    expect((await confirmLinks(id)).map((link) => link.tokenHash).sort()).toEqual(
      [owners, strangers, resent].map(hashToken).sort(),
    )

    await expect(confirm(resent, STRANGER_PASSWORD)).resolves.toMatchObject({ formError: expect.any(String) })
    await expect(confirm(resent, OWNER_PASSWORD)).resolves.toBe('REDIRECT /login?confirmed=1')
    const confirmed = await account(email)
    expect(confirmed.name).toBe('Owner')
    expect(await bcrypt.compare(OWNER_PASSWORD, confirmed.passwordHash)).toBe(true)
    expect(await confirmLinks(id)).toEqual([])
    await expect(confirm(owners, OWNER_PASSWORD)).resolves.toBe('REDIRECT /join/confirm?invalid=1')
  })

  it('a link issued before links carried a sign-up confirms with the member row\'s password and keeps its details', async () => {
    const member = await createMember({ confirmed: false, name: 'Legacy Name' })
    const { token, row } = newMemberToken(member.id, 'confirm_email')
    await insertMemberToken(getDb(), row)
    const strangers = await signUpAs(member.email, 'Stranger', STRANGER_PASSWORD)

    await expect(confirm(token, STRANGER_PASSWORD)).resolves.toMatchObject({ formError: expect.any(String) })
    await expect(confirm(token, TEST_PASSWORD)).resolves.toBe('REDIRECT /login?confirmed=1')

    const confirmed = await account(member.email)
    expect(confirmed).toMatchObject({
      name: 'Legacy Name',
      passwordHash: member.passwordHash,
      privacyPolicyVersion: member.privacyPolicyVersion,
      emailConfirmedAt: expect.any(Date),
    })
    await expect(confirm(strangers, STRANGER_PASSWORD)).resolves.toBe('REDIRECT /join/confirm?invalid=1')
  })

  it('refuses a link carrying only part of a sign-up, or a reset link carrying one', async () => {
    const member = await createMember({ confirmed: false })
    const partial = newMemberToken(member.id, 'confirm_email').row
    await expect(insertMemberToken(getDb(), { ...partial, passwordHash: 'h' } as typeof partial)).rejects.toThrow()
    const reset = newMemberToken(member.id, 'reset_password').row
    const signUp = { name: 'n', passwordHash: 'h', privacyPolicyVersion: 'v', ageConfirmedAt: new Date(), termsAcceptedAt: new Date() }
    await expect(insertMemberToken(getDb(), { ...reset, ...signUp })).rejects.toThrow()
  })
})
