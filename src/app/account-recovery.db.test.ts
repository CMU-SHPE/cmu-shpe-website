import { createHash } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  class Redirect extends Error {
    constructor(readonly url: string) {
      super(`REDIRECT ${url}`)
    }
  }
  return {
    Redirect,
    auth: vi.fn(),
    sendEmail: vi.fn<(message: { to: string; subject: string; text: string }) => Promise<void>>(async () => {}),
    afterCallbacks: [] as (() => Promise<void>)[],
  }
})

vi.mock('@/auth', () => ({ auth: mocks.auth, signIn: vi.fn(), signOut: vi.fn() }))
vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new mocks.Redirect(url)
  },
}))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '198.51.100.4' }) }))
vi.mock('next/server', () => ({ after: (callback: () => Promise<void>) => mocks.afterCallbacks.push(callback) }))
vi.mock('@/lib/site-url', () => ({ siteUrl: () => 'https://shpe.test' }))
vi.mock('@/lib/email', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email')>()),
  sendEmail: mocks.sendEmail,
}))

import { getDb } from '@/db'
import {
  adminTokens,
  admins,
  eventRsvps,
  loginAttempts,
  memberEmailChanges,
  memberTokens,
  memberTopicSubscriptions,
  members,
  newsletterRecipients,
  newsletters,
  newsletterTopics,
} from '@/db/schema'
import { currentAdmin } from '@/lib/admin'
import { newAdminResetToken, replaceAdminResetTokens } from '@/lib/admin-tokens'
import { confirmEmailChange, newEmailChange, savePendingEmailChange } from '@/lib/member-email-change'
import { hashToken, insertMemberToken, newMemberToken } from '@/lib/member-tokens'
import { resolveUnsubscribeToken } from '@/lib/newsletter-unsubscribe'
import { unsubscribeTokenFor } from '@/lib/newsletter-unsubscribe-token'
import { TEST_PASSWORD, createAdmin, createEvent, createMember, createSponsor, resetDb } from '@/test/db'
import { requestPasswordReset } from './forgot-password/actions'
import { resetMemberPassword } from './reset-password/actions'
import { resetAdminPasswordWithLink } from './reset-password/admin/actions'

const NEW_PASSWORD = 'a fresh passphrase 2026'

async function redirectOf(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(mocks.Redirect)
  return (error as InstanceType<typeof mocks.Redirect>).url
}

function resetForm(token: string, password = NEW_PASSWORD) {
  const formData = new FormData()
  formData.set('token', token)
  formData.set('password', password)
  formData.set('confirmPassword', password)
  return formData
}

async function issueAdminToken(adminId: number, now = Date.now()) {
  const db = getDb()
  const issued = newAdminResetToken(adminId, now)
  await db.batch(replaceAdminResetTokens(db, issued.row))
  return issued.token
}

async function issueMemberResetToken(memberId: number) {
  const issued = newMemberToken(memberId, 'reset_password')
  await insertMemberToken(getDb(), issued.row)
  return issued.token
}

async function adminRow(id: number) {
  const [row] = await getDb().select().from(admins).where(eq(admins.id, id))
  return row
}

async function memberRow(id: number) {
  const [row] = await getDb().select().from(members).where(eq(members.id, id))
  return row
}

async function runAfterResponse() {
  for (const callback of mocks.afterCallbacks.splice(0)) await callback()
}

beforeEach(async () => {
  await resetDb()
  mocks.sendEmail.mockClear()
  mocks.afterCallbacks.length = 0
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('admin password reset by email', () => {
  it('stores only the SHA-256 of an emailed admin link, valid for 30 minutes, in admin_tokens', async () => {
    const admin = await createAdmin({ email: 'ada@shpe.test', role: 'master' })
    const before = Date.now()
    await redirectOf(requestPasswordReset({}, (() => {
      const formData = new FormData()
      formData.set('email', 'ADA@shpe.test')
      return formData
    })()))
    await runAfterResponse()

    const rows = await getDb().select().from(adminTokens)
    expect(rows).toHaveLength(1)
    expect(await getDb().select().from(memberTokens)).toEqual([])
    const token = mocks.sendEmail.mock.calls[0][0].text.match(/\/reset-password\/admin\?token=([\w-]{43})/)![1]
    expect(rows[0].adminId).toBe(admin.id)
    expect(rows[0].tokenHash).toBe(createHash('sha256').update(token).digest('hex'))
    expect(rows[0].tokenHash).not.toContain(token)
    expect(rows[0].expiresAt.getTime() - before).toBeGreaterThanOrEqual(30 * 60 * 1000 - 1000)
    expect(rows[0].expiresAt.getTime() - before).toBeLessThan(31 * 60 * 1000)
  })

  it('resets the master, ends older sessions, clears the lockout and revokes other links, once only', async () => {
    const master = await createAdmin({ email: 'max@shpe.test', role: 'master' })
    const signedInBefore = Date.now() - 1000
    await getDb().insert(loginAttempts).values([{ email: 'max@shpe.test', ip: '1.2.3.4' }, { email: 'max@shpe.test', ip: null }])
    const older = await issueAdminToken(master.id)
    const db = getDb()
    const newer = newAdminResetToken(master.id)
    await db.insert(adminTokens).values(newer.row)

    expect(await redirectOf(resetAdminPasswordWithLink({}, resetForm(older)))).toBe('/login?reset=1')

    const row = await adminRow(master.id)
    expect(await bcrypt.compare(NEW_PASSWORD, row.passwordHash)).toBe(true)
    expect(row.role).toBe('master')
    expect(row.passwordChangedAt!.getTime()).toBeGreaterThan(signedInBefore)
    expect(await db.select().from(loginAttempts)).toEqual([])
    expect(await db.select().from(adminTokens)).toEqual([])
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'max@shpe.test', subject: 'Your SHPE @ CMU password was changed' }))

    mocks.auth.mockResolvedValue({
      user: { id: String(master.id), email: 'max@shpe.test', kind: 'admin', role: 'master' },
      authTime: signedInBefore,
      expires: '',
    })
    expect(await currentAdmin()).toBeNull()

    await expect(resetAdminPasswordWithLink({}, resetForm(older, 'yet another passphrase'))).resolves.toEqual({
      formError: expect.stringContaining('expired'),
    })
    await expect(resetAdminPasswordWithLink({}, resetForm(newer.token, 'yet another passphrase'))).resolves.toEqual({
      formError: expect.stringContaining('expired'),
    })
    expect(await bcrypt.compare(NEW_PASSWORD, (await adminRow(master.id)).passwordHash)).toBe(true)
  })

  it('refuses an expired admin link and keeps the old password', async () => {
    const admin = await createAdmin()
    const token = await issueAdminToken(admin.id, Date.now() - 31 * 60 * 1000)
    await expect(resetAdminPasswordWithLink({}, resetForm(token))).resolves.toEqual({
      formError: expect.stringContaining('expired'),
    })
    expect(await bcrypt.compare(TEST_PASSWORD, (await adminRow(admin.id)).passwordHash)).toBe(true)
  })

  it('applies the shared password policy and leaves the link working after a refused password', async () => {
    const admin = await createAdmin()
    const token = await issueAdminToken(admin.id)
    const result = await resetAdminPasswordWithLink({}, resetForm(token, 'short'))
    expect(result.errors).toMatchObject({ password: expect.any(String) })
    expect(await redirectOf(resetAdminPasswordWithLink({}, resetForm(token)))).toBe('/login?reset=1')
  })

  it('never lets a member link reset an admin, even with the same id and email, and leaves that link working', async () => {
    const admin = await createAdmin({ email: 'shared@shpe.test' })
    const member = await createMember({ email: 'shared@shpe.test' })
    expect(admin.id).toBe(member.id)
    const memberToken = await issueMemberResetToken(member.id)

    await expect(resetAdminPasswordWithLink({}, resetForm(memberToken))).resolves.toEqual({
      formError: expect.stringContaining('expired'),
    })
    expect(await bcrypt.compare(TEST_PASSWORD, (await adminRow(admin.id)).passwordHash)).toBe(true)
    expect((await adminRow(admin.id)).passwordChangedAt).toBeNull()
    expect(await getDb().select().from(memberTokens)).toHaveLength(1)

    expect(await redirectOf(resetMemberPassword({}, resetForm(memberToken)))).toBe('/login?reset=1')
    expect(await bcrypt.compare(NEW_PASSWORD, (await memberRow(member.id)).passwordHash)).toBe(true)
    expect(await bcrypt.compare(TEST_PASSWORD, (await adminRow(admin.id)).passwordHash)).toBe(true)
  })

  it('never lets an admin link reset a member, even with the same id and email, and leaves that link working', async () => {
    const admin = await createAdmin({ email: 'shared@shpe.test' })
    const member = await createMember({ email: 'shared@shpe.test' })
    expect(admin.id).toBe(member.id)
    const adminToken = await issueAdminToken(admin.id)

    await expect(resetMemberPassword({}, resetForm(adminToken))).resolves.toEqual({
      formError: expect.stringContaining('expired'),
    })
    expect(await bcrypt.compare(TEST_PASSWORD, (await memberRow(member.id)).passwordHash)).toBe(true)
    expect((await memberRow(member.id)).passwordChangedAt).toBeNull()
    expect(await getDb().select().from(adminTokens)).toHaveLength(1)

    expect(await redirectOf(resetAdminPasswordWithLink({}, resetForm(adminToken)))).toBe('/login?reset=1')
    expect(await bcrypt.compare(NEW_PASSWORD, (await adminRow(admin.id)).passwordHash)).toBe(true)
    expect(await bcrypt.compare(TEST_PASSWORD, (await memberRow(member.id)).passwordHash)).toBe(true)
  })

  it('lets only one of two racing submits of the same admin link set a password', async () => {
    const admin = await createAdmin()
    const token = await issueAdminToken(admin.id)
    const outcomes = await Promise.all([
      resetAdminPasswordWithLink({}, resetForm(token, 'racing passphrase one')).catch((e: unknown) => e),
      resetAdminPasswordWithLink({}, resetForm(token, 'racing passphrase two')).catch((e: unknown) => e),
    ])
    expect(outcomes.filter((outcome) => outcome instanceof mocks.Redirect)).toHaveLength(1)
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
  })
})

describe('member email change', () => {
  async function pendingChange(memberId: number, newEmail: string, now = Date.now()) {
    const db = getDb()
    const change = newEmailChange(memberId, newEmail, now)
    await savePendingEmailChange(db, change.row)
    return change.token
  }

  it('stores only the hash, one pending change per member, and a newer request kills the older link', async () => {
    const member = await createMember()
    const first = await pendingChange(member.id, 'first@new.test')
    const second = await pendingChange(member.id, 'second@new.test')

    const rows = await getDb().select().from(memberEmailChanges)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ memberId: member.id, newEmail: 'second@new.test', tokenHash: hashToken(second) })
    expect(rows[0].tokenHash).not.toBe(second)

    expect(await confirmEmailChange(first)).toEqual({ status: 'invalid' })
    expect(await confirmEmailChange(second)).toMatchObject({ status: 'changed', newEmail: 'second@new.test' })
  })

  it('keeps the member id, so the sponsor link, RSVPs, topics and past unsubscribe links all stay', async () => {
    vi.stubEnv('AUTH_SECRET', 'db-test-secret')
    const db = getDb()
    const sponsor = await createSponsor()
    const member = await createMember({ role: 'sponsor', sponsorId: sponsor.id, email: 'old@shpe.test' })
    const event = await createEvent()
    await db.insert(eventRsvps).values({ eventId: event.id, memberId: member.id })
    const [topic] = await db.insert(newsletterTopics).values({ name: 'Events' }).returning()
    await db.insert(memberTopicSubscriptions).values({ memberId: member.id, topicId: topic.id })
    const [newsletter] = await db.insert(newsletters).values({ subject: 'Hi', status: 'sent' }).returning()
    const [recipient] = await db
      .insert(newsletterRecipients)
      .values({ newsletterId: newsletter.id, memberId: member.id, chunk: 0, status: 'sent' })
      .returning()
    const unsubscribeToken = unsubscribeTokenFor(recipient.id)
    await db.update(newsletterRecipients).set({ unsubscribeTokenHash: hashToken(unsubscribeToken) })
    const resetToken = await issueMemberResetToken(member.id)

    const token = await pendingChange(member.id, 'new@shpe.test')
    expect(await confirmEmailChange(token)).toEqual({
      status: 'changed',
      oldEmail: 'old@shpe.test',
      newEmail: 'new@shpe.test',
      name: member.name,
    })

    const row = await memberRow(member.id)
    expect(row).toMatchObject({ id: member.id, email: 'new@shpe.test', role: 'sponsor', sponsorId: sponsor.id })
    expect(await db.select().from(eventRsvps)).toEqual([expect.objectContaining({ memberId: member.id })])
    expect(await db.select().from(memberTopicSubscriptions)).toEqual([expect.objectContaining({ memberId: member.id })])
    expect(await resolveUnsubscribeToken(unsubscribeToken)).toMatchObject({
      maskedEmail: 'n***@shpe.test',
      subscribedInScope: [],
      otherSubscriptions: [{ id: topic.id, name: 'Events' }],
    })
    expect(await db.select().from(memberEmailChanges)).toEqual([])
    await expect(resetMemberPassword({}, resetForm(resetToken))).resolves.toEqual({
      formError: expect.stringContaining('expired'),
    })
    expect(await confirmEmailChange(token)).toEqual({ status: 'invalid' })
    vi.unstubAllEnvs()
  })

  it('refuses an expired link without changing anything', async () => {
    const member = await createMember({ email: 'old@shpe.test' })
    const token = await pendingChange(member.id, 'new@shpe.test', Date.now() - 25 * 60 * 60 * 1000)
    expect(await confirmEmailChange(token)).toEqual({ status: 'invalid' })
    expect((await memberRow(member.id)).email).toBe('old@shpe.test')
  })

  it.each([
    ['an admin', async () => createAdmin({ email: 'Taken@Shpe.test' })],
    ['another confirmed member', async () => createMember({ email: 'taken@shpe.test' })],
  ])('refuses an address that by confirm time belongs to %s, compared case-insensitively', async (_case, takeAddress) => {
    const member = await createMember({ email: 'old@shpe.test' })
    const token = await pendingChange(member.id, 'taken@shpe.test')
    await takeAddress()
    expect(await confirmEmailChange(token)).toEqual({ status: 'in_use' })
    expect((await memberRow(member.id)).email).toBe('old@shpe.test')
    expect(await confirmEmailChange(token)).toEqual({ status: 'invalid' })
  })

  it('takes the address over from an unconfirmed sign-up, since the confirmer controls that inbox', async () => {
    const member = await createMember({ email: 'old@shpe.test' })
    const squatter = await createMember({ email: 'wanted@shpe.test', confirmed: false })
    const token = await pendingChange(member.id, 'wanted@shpe.test')
    expect(await confirmEmailChange(token)).toMatchObject({ status: 'changed' })
    expect(await memberRow(squatter.id)).toBeUndefined()
    expect((await memberRow(member.id)).email).toBe('wanted@shpe.test')
  })

  it('leaves an unconfirmed holder alone when the link is not valid', async () => {
    const member = await createMember({ email: 'old@shpe.test' })
    const squatter = await createMember({ email: 'wanted@shpe.test', confirmed: false })
    const token = await pendingChange(member.id, 'wanted@shpe.test', Date.now() - 25 * 60 * 60 * 1000)
    expect(await confirmEmailChange(token)).toEqual({ status: 'invalid' })
    expect(await memberRow(squatter.id)).toBeDefined()
  })

  it('lets only one of two members racing to confirm the same address win', async () => {
    const first = await createMember({ email: 'first@shpe.test' })
    const second = await createMember({ email: 'second@shpe.test' })
    const [firstToken, secondToken] = [
      await pendingChange(first.id, 'race@shpe.test'),
      await pendingChange(second.id, 'race@shpe.test'),
    ]
    const results = await Promise.all([confirmEmailChange(firstToken), confirmEmailChange(secondToken)])
    expect(results.map((result) => result.status).sort()).toEqual(['changed', 'in_use'])
    const holders = await getDb().select({ id: members.id }).from(members).where(eq(members.email, 'race@shpe.test'))
    expect(holders).toHaveLength(1)
  })
})
