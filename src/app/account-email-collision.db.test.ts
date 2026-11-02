import bcrypt from 'bcryptjs'
import { eq, sql } from 'drizzle-orm'
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
    accountCreatorId: 0,
    sendEmail: vi.fn<(message: { to: string; subject: string; text: string }) => Promise<void>>(async () => {}),
  }
})

vi.mock('@/auth', () => ({ auth: mocks.auth, signIn: vi.fn(), signOut: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new mocks.Redirect(url)
  },
}))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '198.51.100.4' }) }))
vi.mock('@/lib/site-url', () => ({ siteUrl: () => 'https://shpe.test' }))
vi.mock('@/lib/email', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email')>()),
  sendEmail: mocks.sendEmail,
}))
vi.mock('@/lib/admin', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/admin')>()),
  requireAccountCreator: async () => ({ user: { id: String(mocks.accountCreatorId), kind: 'admin' } }),
}))

import { getDb } from '@/db'
import { resetMasterAccount } from '@/db/reset-master-writes'
import { adminTokens, admins, loginAttempts, members, memberTokens } from '@/db/schema'
import { currentAdmin } from '@/lib/admin'
import { newAdminResetToken } from '@/lib/admin-tokens'
import { authorizeCredentials } from '@/lib/authorize'
import { confirmEmailChange, newEmailChange, savePendingEmailChange } from '@/lib/member-email-change'
import { TEST_PASSWORD, createAdmin, createMember, raceInOrderBehindAccountEmailLock, resetDb } from '@/test/db'
import { createAdmin as createAdminAction } from './admin/admins/actions'
import { signUp } from './join/actions'

const NEW_PASSWORD = 'a fresh passphrase 2026'

beforeEach(async () => {
  await resetDb()
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue(null)
  mocks.accountCreatorId = (await createAdmin({ email: 'creator@shpe.test', canCreateAccounts: true })).id
})

async function outcome(promise: Promise<unknown>) {
  const result = await promise.catch((e: unknown) => e)
  if (result instanceof mocks.Redirect) return result.url
  throw result
}

function adminForm(email: string) {
  const formData = new FormData()
  formData.set('name', 'New Admin')
  formData.set('email', email)
  formData.set('password', NEW_PASSWORD)
  return formData
}

function signUpForm(email: string) {
  const formData = new FormData()
  for (const [name, value] of Object.entries({
    name: 'New Member',
    email,
    password: NEW_PASSWORD,
    confirmPassword: NEW_PASSWORD,
    ageConfirmed: 'on',
    termsAccepted: 'on',
  })) {
    formData.set(name, value)
  }
  return formData
}

async function holders(email: string) {
  const db = getDb()
  const [adminRows, memberRows] = await Promise.all([
    db.select({ id: admins.id }).from(admins).where(sql`lower(${admins.email}) = ${email}`),
    db.select({ id: members.id }).from(members).where(sql`lower(${members.email}) = ${email}`),
  ])
  return { admins: adminRows.length, members: memberRows.length }
}

async function pendingChange(memberId: number, newEmail: string) {
  const change = newEmailChange(memberId, newEmail)
  await savePendingEmailChange(getDb(), change.row)
  return change.token
}

describe('createAdmin', () => {
  it('refuses an address a member already uses, in any letter case', async () => {
    await createMember({ email: 'Ada@SHPE.test', confirmed: false })
    expect(await outcome(createAdminAction(adminForm('ada@shpe.test')))).toBe('/admin/admins?error=duplicate')
    expect(await holders('ada@shpe.test')).toEqual({ admins: 0, members: 1 })
  })

  it('refuses an address a sign-up took while the new admin’s password was hashing', async () => {
    const results = await raceInOrderBehindAccountEmailLock<unknown>([
      () => outcome(signUp({}, signUpForm('race@shpe.test'))),
      () => outcome(createAdminAction(adminForm('race@shpe.test'))),
    ])
    expect(results).toEqual(['/join/check-email', '/admin/admins?error=duplicate'])
    expect(await holders('race@shpe.test')).toEqual({ admins: 0, members: 1 })
  })

  it('refuses an address an email change took while the new admin’s password was hashing', async () => {
    const member = await createMember({ email: 'old@shpe.test' })
    const token = await pendingChange(member.id, 'race@shpe.test')
    const results = await raceInOrderBehindAccountEmailLock<unknown>([
      () => confirmEmailChange(token),
      () => outcome(createAdminAction(adminForm('race@shpe.test'))),
    ])
    expect(results).toEqual([expect.objectContaining({ status: 'changed' }), '/admin/admins?error=duplicate'])
    expect(await holders('race@shpe.test')).toEqual({ admins: 0, members: 1 })
  })

  it('lets two admins with different addresses be created at the same time', async () => {
    const results = await raceInOrderBehindAccountEmailLock<unknown>([
      () => outcome(createAdminAction(adminForm('one@shpe.test'))),
      () => outcome(createAdminAction(adminForm('two@shpe.test'))),
    ])
    expect(results).toEqual(['/admin/admins?saved=1', '/admin/admins?saved=1'])
    expect(await holders('one@shpe.test')).toEqual({ admins: 1, members: 0 })
    expect(await holders('two@shpe.test')).toEqual({ admins: 1, members: 0 })
  })
})

describe('signUp', () => {
  it('answers as for an admin when an admin is created after its lookup, keeping no member row or link', async () => {
    const results = await raceInOrderBehindAccountEmailLock<unknown>([
      () => outcome(createAdminAction(adminForm('race@shpe.test'))),
      () => outcome(signUp({}, signUpForm('race@shpe.test'))),
    ])
    expect(results).toEqual(['/admin/admins?saved=1', '/join/check-email'])
    expect(await holders('race@shpe.test')).toEqual({ admins: 1, members: 0 })
    expect(await getDb().select().from(memberTokens)).toEqual([])
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
    expect(mocks.sendEmail.mock.calls[0][0]).toMatchObject({ to: 'race@shpe.test' })
    expect(mocks.sendEmail.mock.calls[0][0].text).toContain('already belongs to a site admin')
  })

  it('answers as for an admin whose address differs only in letter case', async () => {
    await createAdmin({ email: 'Ada@SHPE.test' })
    expect(await outcome(signUp({}, signUpForm('ada@shpe.test')))).toBe('/join/check-email')
    expect(await holders('ada@shpe.test')).toEqual({ admins: 1, members: 0 })
    expect(mocks.sendEmail.mock.calls[0][0].text).toContain('already belongs to a site admin')
  })
})

describe('member email change', () => {
  it('refuses an address an admin took after the change was requested', async () => {
    const member = await createMember({ email: 'old@shpe.test' })
    const token = await pendingChange(member.id, 'race@shpe.test')
    const results = await raceInOrderBehindAccountEmailLock<unknown>([
      () => outcome(createAdminAction(adminForm('race@shpe.test'))),
      () => confirmEmailChange(token),
    ])
    expect(results).toEqual(['/admin/admins?saved=1', { status: 'in_use' }])
    expect(await holders('race@shpe.test')).toEqual({ admins: 1, members: 0 })
  })
})

describe('db:reset-master', () => {
  async function master(email = 'max@shpe.test') {
    return createAdmin({ email, role: 'master' })
  }

  async function adminRow(id: number) {
    const [row] = await getDb().select().from(admins).where(eq(admins.id, id))
    return row
  }

  async function issueAdminToken(adminId: number) {
    await getDb().insert(adminTokens).values(newAdminResetToken(adminId).row)
  }

  async function expectUntouched(id: number, email: string) {
    const row = await adminRow(id)
    expect(row.email).toBe(email)
    expect(await bcrypt.compare(TEST_PASSWORD, row.passwordHash)).toBe(true)
    expect(row.passwordChangedAt).toBeNull()
    expect(await getDb().select().from(adminTokens)).toHaveLength(1)
    expect(await getDb().select().from(loginAttempts)).toHaveLength(1)
  }

  it('refuses when there is no master', async () => {
    expect(await resetMasterAccount(getDb(), 'max@shpe.test', 'new hash')).toEqual({ status: 'no-master' })
    expect(await holders('max@shpe.test')).toEqual({ admins: 0, members: 0 })
  })

  it('refuses when there are several masters and changes neither', async () => {
    const [first, second] = [await master('one@shpe.test'), await master('two@shpe.test')]
    expect(await resetMasterAccount(getDb(), 'max@shpe.test', 'new hash')).toEqual({ status: 'several-masters', count: 2 })
    expect((await adminRow(first.id)).email).toBe('one@shpe.test')
    expect((await adminRow(second.id)).email).toBe('two@shpe.test')
  })

  it('refuses an address another admin uses, in any letter case, and writes nothing', async () => {
    const row = await master()
    await createAdmin({ email: 'Taken@shpe.test' })
    await issueAdminToken(row.id)
    await getDb().insert(loginAttempts).values({ email: 'max@shpe.test', ip: null })
    expect(await resetMasterAccount(getDb(), 'taken@shpe.test', 'new hash')).toEqual({ status: 'admin-taken' })
    await expectUntouched(row.id, 'max@shpe.test')
  })

  it('refuses an address a member uses, in any letter case, and writes nothing', async () => {
    const row = await master()
    await createMember({ email: 'Mia@shpe.test', confirmed: false })
    await issueAdminToken(row.id)
    await getDb().insert(loginAttempts).values({ email: 'max@shpe.test', ip: null })
    expect(await resetMasterAccount(getDb(), 'mia@shpe.test', 'new hash')).toEqual({ status: 'member-taken' })
    await expectUntouched(row.id, 'max@shpe.test')
    expect(await holders('mia@shpe.test')).toEqual({ admins: 0, members: 1 })
  })

  it('still resets the password of a master whose own address a member already shares', async () => {
    const row = await master()
    await createMember({ email: 'max@shpe.test' })
    const result = await resetMasterAccount(getDb(), 'max@shpe.test', await bcrypt.hash(NEW_PASSWORD, 4))
    expect(result).toEqual({ status: 'reset', previousEmail: 'max@shpe.test' })
    expect(await bcrypt.compare(NEW_PASSWORD, (await adminRow(row.id)).passwordHash)).toBe(true)
  })

  it('moves the master, clears both addresses’ lockouts, ends older sessions and signs in with the new password', async () => {
    const db = getDb()
    const row = await master()
    const other = await createAdmin()
    await issueAdminToken(row.id)
    await issueAdminToken(other.id)
    await db.insert(loginAttempts).values([
      { email: 'max@shpe.test', ip: '1.2.3.4' },
      { email: 'new-max@shpe.test', ip: null },
      { email: other.email, ip: null },
    ])
    const signedInBefore = Date.now() - 1000

    const result = await resetMasterAccount(db, 'new-max@shpe.test', await bcrypt.hash(NEW_PASSWORD, 4))

    expect(result).toEqual({ status: 'reset', previousEmail: 'max@shpe.test' })
    expect(await db.select({ email: loginAttempts.email }).from(loginAttempts)).toEqual([{ email: other.email }])
    expect(await db.select({ adminId: adminTokens.adminId }).from(adminTokens)).toEqual([{ adminId: other.id }])
    expect((await adminRow(row.id)).role).toBe('master')

    const session = { user: { id: String(row.id), email: 'new-max@shpe.test', kind: 'admin', role: 'master' }, expires: '' }
    mocks.auth.mockResolvedValue({ ...session, authTime: signedInBefore })
    expect(await currentAdmin()).toBeNull()

    expect(await authorizeCredentials({ email: 'max@shpe.test', password: NEW_PASSWORD }, null)).toBeNull()
    const signedIn = await authorizeCredentials({ email: 'new-max@shpe.test', password: NEW_PASSWORD }, null)
    expect(signedIn).toMatchObject({ kind: 'admin', role: 'master' })
    mocks.auth.mockResolvedValue({ ...session, authTime: signedIn!.authTime })
    expect(await currentAdmin()).not.toBeNull()
  })

  it('refuses an address a sign-up committed after the reset started', async () => {
    const row = await master()
    const results = await raceInOrderBehindAccountEmailLock<unknown>([
      () => outcome(signUp({}, signUpForm('race@shpe.test'))),
      () => resetMasterAccount(getDb(), 'race@shpe.test', 'new hash'),
    ])
    expect(results).toEqual(['/join/check-email', { status: 'member-taken' }])
    expect((await adminRow(row.id)).email).toBe('max@shpe.test')
    expect(await holders('race@shpe.test')).toEqual({ admins: 0, members: 1 })
  })

  it('makes a sign-up for the new address answer as for an admin when the reset commits first', async () => {
    await master()
    const results = await raceInOrderBehindAccountEmailLock<unknown>([
      () => resetMasterAccount(getDb(), 'race@shpe.test', 'new hash'),
      () => outcome(signUp({}, signUpForm('race@shpe.test'))),
    ])
    expect(results).toEqual([{ status: 'reset', previousEmail: 'max@shpe.test' }, '/join/check-email'])
    expect(await holders('race@shpe.test')).toEqual({ admins: 1, members: 0 })
    expect(mocks.sendEmail.mock.calls[0][0].text).toContain('already belongs to a site admin')
  })
})
