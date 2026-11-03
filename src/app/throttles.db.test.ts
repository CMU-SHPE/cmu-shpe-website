import { and, eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  class Redirect extends Error {
    constructor(readonly url: string) {
      super(`REDIRECT ${url}`)
    }
  }
  return {
    Redirect,
    ip: '198.51.100.4',
    auth: vi.fn(),
    signIn: vi.fn(),
    sendEmail: vi.fn<(message: { to: string; subject: string; text: string }) => Promise<void>>(async () => {}),
    afterCallbacks: [] as (() => Promise<void>)[],
    cookies: new Map<string, string>(),
  }
})

vi.mock('@/auth', () => ({ auth: mocks.auth, signIn: mocks.signIn, signOut: vi.fn() }))
vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new mocks.Redirect(url)
  },
  unstable_rethrow: (error: unknown) => {
    throw error
  },
}))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': mocks.ip }),
  cookies: async () => ({
    get: (name: string) => (mocks.cookies.has(name) ? { name, value: mocks.cookies.get(name)! } : undefined),
    set: (name: string, value: string) => mocks.cookies.set(name, value),
  }),
}))
vi.mock('next/server', () => ({ after: (callback: () => Promise<void>) => mocks.afterCallbacks.push(callback) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/site-url', () => ({ siteUrl: () => 'https://shpe.test' }))
vi.mock('@/lib/email', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email')>()),
  sendEmail: mocks.sendEmail,
}))

import { getDb } from '@/db'
import { loginAttempts, members, requestThrottle } from '@/db/schema'
import { newAdminResetToken, replaceAdminResetTokens } from '@/lib/admin-tokens'
import { authorizeCredentials, recordLoginAttempt } from '@/lib/authorize'
import { KNOWN_DEVICE_COOKIE, deviceAccountFor, withKnownDevice } from '@/lib/known-device'
import { LOGIN_LIMITS } from '@/lib/login-throttle'
import { REQUEST_LIMITS, recordRequest, type ThrottledAction } from '@/lib/request-throttle'
import { TEST_PASSWORD, createAdmin, createMember, resetDb } from '@/test/db'
import { changePassword as changeMemberPassword, deleteAccount } from './account/actions'
import { changePassword as changeAdminPassword } from './admin/account/actions'
import { requestPasswordReset } from './forgot-password/actions'
import { signUp } from './join/actions'
import { resendConfirmation } from './join/resend/actions'
import { resetAdminPasswordWithLink } from './reset-password/admin/actions'

const OWNER_IP = '192.0.2.10'
const STRANGER_IP = '203.0.113.66'
const WRONG = 'a wrong guess entirely'
const NEW_PASSWORD = 'a fresh passphrase 2026'

const strangerIp = (n: number) => `203.0.113.${n}`
const signIn = (email: string, password: string, ip: string) => authorizeCredentials({ email, password }, ip)

async function redirectOf(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(mocks.Redirect)
  return (error as InstanceType<typeof mocks.Redirect>).url
}

function emailForm(email: string) {
  const formData = new FormData()
  formData.set('email', email)
  return formData
}

async function forgotPassword(email: string, ip: string) {
  mocks.ip = ip
  const url = await redirectOf(requestPasswordReset({}, emailForm(email)))
  for (const callback of mocks.afterCallbacks.splice(0)) await callback()
  return url
}

function signUpForm(email: string, password: string) {
  const formData = new FormData()
  formData.set('name', 'Sam Owner')
  formData.set('email', email)
  formData.set('password', password)
  formData.set('confirmPassword', password)
  formData.set('ageConfirmed', 'on')
  formData.set('termsAccepted', 'on')
  return formData
}

function passwordChangeForm(currentPassword: string) {
  const formData = new FormData()
  formData.set('currentPassword', currentPassword)
  formData.set('newPassword', NEW_PASSWORD)
  formData.set('confirmPassword', NEW_PASSWORD)
  return formData
}

const emailsTo = (address: string) => mocks.sendEmail.mock.calls.filter(([message]) => message.to === address)

beforeEach(async () => {
  await resetDb()
  mocks.ip = OWNER_IP
  mocks.sendEmail.mockClear()
  mocks.signIn.mockReset()
  mocks.auth.mockReset()
  mocks.afterCallbacks.length = 0
  mocks.cookies.clear()
  vi.stubEnv('AUTH_SECRET', 'a test secret for known devices')
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('sign-in', () => {
  it("doesn't let a stranger's wrong passwords stop the real admin from their own network", async () => {
    await createAdmin({ email: 'max@shpe.test', role: 'master' })
    for (let attempt = 0; attempt < LOGIN_LIMITS.perEmailAndIp * 3; attempt += 1) {
      await expect(signIn('max@shpe.test', WRONG, STRANGER_IP)).resolves.toBeNull()
    }
    await expect(signIn('max@shpe.test', TEST_PASSWORD, OWNER_IP)).resolves.toMatchObject({ email: 'max@shpe.test' })
  })

  it('still refuses one source its next guess, even when that guess is right', async () => {
    await createAdmin({ email: 'max@shpe.test' })
    for (let attempt = 0; attempt < LOGIN_LIMITS.perEmailAndIp; attempt += 1) {
      await signIn('max@shpe.test', WRONG, STRANGER_IP)
    }
    await expect(signIn('max@shpe.test', TEST_PASSWORD, STRANGER_IP)).resolves.toBeNull()
  })

  it('limits guessing spread over many sources with the per-email ceiling', async () => {
    await createAdmin({ email: 'max@shpe.test' })
    const db = getDb()
    await db.insert(loginAttempts).values(
      Array.from({ length: LOGIN_LIMITS.perEmail }, (_, n) => ({ email: 'max@shpe.test', ip: strangerIp(n % 250) })),
    )
    await expect(signIn('max@shpe.test', TEST_PASSWORD, '192.0.2.99')).resolves.toBeNull()
  })

  it('counts every address of one IPv6 network as one source', async () => {
    await createAdmin({ email: 'max@shpe.test' })
    for (let host = 1; host <= LOGIN_LIMITS.perEmailAndIp; host += 1) {
      await signIn('max@shpe.test', WRONG, `2001:db8:1:2::${host}`)
    }
    await expect(signIn('max@shpe.test', TEST_PASSWORD, '2001:db8:1:2::ffff')).resolves.toBeNull()
    await expect(signIn('max@shpe.test', TEST_PASSWORD, '2001:db8:1:3::1')).resolves.toMatchObject({ email: 'max@shpe.test' })
  })

  it("doesn't count refused guesses towards the ceiling, however long one source keeps going", async () => {
    await createAdmin({ email: 'max@shpe.test' })
    for (let attempt = 0; attempt < LOGIN_LIMITS.perEmailAndIp + 5; attempt += 1) {
      await signIn('max@shpe.test', WRONG, STRANGER_IP)
    }
    expect(await getDb().select().from(loginAttempts)).toHaveLength(LOGIN_LIMITS.perEmailAndIp)
  })

  it("keeps a stranger's guesses counted when the owner signs in", async () => {
    await createAdmin({ email: 'max@shpe.test' })
    for (let attempt = 0; attempt < LOGIN_LIMITS.perEmailAndIp; attempt += 1) {
      await signIn('max@shpe.test', WRONG, STRANGER_IP)
    }
    await expect(signIn('max@shpe.test', TEST_PASSWORD, OWNER_IP)).resolves.not.toBeNull()
    await expect(signIn('max@shpe.test', TEST_PASSWORD, STRANGER_IP)).resolves.toBeNull()
  })

  it('still limits guessing when the source is unknown', async () => {
    await createAdmin({ email: 'max@shpe.test' })
    for (let attempt = 0; attempt < LOGIN_LIMITS.perEmailAndIp; attempt += 1) {
      await authorizeCredentials({ email: 'max@shpe.test', password: WRONG }, null)
    }
    await expect(authorizeCredentials({ email: 'max@shpe.test', password: TEST_PASSWORD }, null)).resolves.toBeNull()
  })

  it('limits one source trying many accounts, with room for a campus sharing it', async () => {
    await createAdmin({ email: 'max@shpe.test' })
    for (let n = 0; n < LOGIN_LIMITS.perIp; n += 1) {
      await getDb().insert(loginAttempts).values({ email: `someone${n}@shpe.test`, ip: STRANGER_IP })
    }
    await expect(signIn('max@shpe.test', TEST_PASSWORD, STRANGER_IP)).resolves.toBeNull()
    await expect(signIn('max@shpe.test', TEST_PASSWORD, OWNER_IP)).resolves.not.toBeNull()
  })
})

describe('/forgot-password', () => {
  it("doesn't let a stranger's requests stop the real master's reset email", async () => {
    await createAdmin({ email: 'max@shpe.test', role: 'master' })
    const answers = new Set<string>()
    for (let attempt = 0; attempt < REQUEST_LIMITS.admin_password_reset.perEmailAndIp + 2; attempt += 1) {
      answers.add(await forgotPassword('max@shpe.test', STRANGER_IP))
    }
    const sentToStranger = emailsTo('max@shpe.test').length
    expect(sentToStranger).toBe(REQUEST_LIMITS.admin_password_reset.perEmailAndIp)

    answers.add(await forgotPassword('max@shpe.test', OWNER_IP))
    expect(emailsTo('max@shpe.test')).toHaveLength(sentToStranger + 1)
    expect(emailsTo('max@shpe.test').at(-1)![0].text).toContain('/reset-password/admin?token=')
    expect([...answers]).toEqual(['/forgot-password?sent=1'])
  })

  it("doesn't let a stranger's requests stop a member's reset email", async () => {
    await createMember({ email: 'mia@shpe.test' })
    for (let attempt = 0; attempt < REQUEST_LIMITS.forgot_password.perEmailAndIp + 2; attempt += 1) {
      await forgotPassword('mia@shpe.test', STRANGER_IP)
    }
    const sent = emailsTo('mia@shpe.test').length
    expect(sent).toBe(REQUEST_LIMITS.forgot_password.perEmailAndIp)
    await forgotPassword('mia@shpe.test', OWNER_IP)
    expect(emailsTo('mia@shpe.test')).toHaveLength(sent + 1)
  })

  it('answers the same for an account, a stranger address, and when refused', async () => {
    await createAdmin({ email: 'max@shpe.test' })
    const answers = new Set<string>()
    for (let attempt = 0; attempt < REQUEST_LIMITS.forgot_password.perEmailAndIp + 1; attempt += 1) {
      answers.add(await forgotPassword('max@shpe.test', STRANGER_IP))
      answers.add(await forgotPassword('nobody@shpe.test', STRANGER_IP))
    }
    expect([...answers]).toEqual(['/forgot-password?sent=1'])
  })

  it('caps the emails one address can receive, after sending a link that still works', async () => {
    await createAdmin({ email: 'max@shpe.test' })
    const { perEmail, perEmailAndIp } = REQUEST_LIMITS.admin_password_reset
    const sources = Math.ceil(perEmail / perEmailAndIp) + 2
    for (let source = 0; source < sources; source += 1) {
      for (let attempt = 0; attempt < perEmailAndIp; attempt += 1) await forgotPassword('max@shpe.test', strangerIp(source))
    }
    expect(emailsTo('max@shpe.test')).toHaveLength(perEmail)
  })
})

describe('account-page password checks', () => {
  it("doesn't let typos on /account stop the member signing in", async () => {
    const member = await createMember({ email: 'mia@shpe.test' })
    mocks.auth.mockResolvedValue({ user: { id: String(member.id), kind: 'member', email: member.email } })
    for (let attempt = 0; attempt < REQUEST_LIMITS.account_password_check.perEmail; attempt += 1) {
      const url = await redirectOf(changeMemberPassword(passwordChangeForm(WRONG)))
      expect(url).toContain('password-current')
    }
    expect(await redirectOf(changeMemberPassword(passwordChangeForm(TEST_PASSWORD)))).toContain('password-throttled')
    expect(await getDb().select().from(loginAttempts)).toEqual([])
    await expect(signIn('mia@shpe.test', TEST_PASSWORD, OWNER_IP)).resolves.toMatchObject({ email: 'mia@shpe.test' })
  })

  it("doesn't let sign-in attempts block a member's /account password check", async () => {
    const member = await createMember({ email: 'mia@shpe.test' })
    mocks.auth.mockResolvedValue({ user: { id: String(member.id), kind: 'member', email: member.email } })
    for (let attempt = 0; attempt < LOGIN_LIMITS.perEmailAndIp + 1; attempt += 1) {
      await signIn('mia@shpe.test', WRONG, OWNER_IP)
    }
    expect(await redirectOf(changeMemberPassword(passwordChangeForm(WRONG)))).toContain('password-current')
  })

  it("keeps an admin's page typos and sign-in apart in both directions", async () => {
    const admin = await createAdmin({ email: 'ada@shpe.test' })
    mocks.auth.mockResolvedValue({ user: { id: String(admin.id), kind: 'admin', role: 'admin', email: admin.email } })
    for (let attempt = 0; attempt < REQUEST_LIMITS.account_password_check.perEmail; attempt += 1) {
      expect(await redirectOf(changeAdminPassword(passwordChangeForm(WRONG)))).toContain('error=current')
    }
    expect(await redirectOf(changeAdminPassword(passwordChangeForm(TEST_PASSWORD)))).toContain('error=throttled')
    await expect(signIn('ada@shpe.test', TEST_PASSWORD, OWNER_IP)).resolves.not.toBeNull()

    await getDb()
      .delete(requestThrottle)
      .where(and(eq(requestThrottle.action, 'account_password_check'), eq(requestThrottle.email, 'ada@shpe.test')))
    for (let attempt = 0; attempt < LOGIN_LIMITS.perEmailAndIp + 1; attempt += 1) await signIn('ada@shpe.test', WRONG, OWNER_IP)
    expect(await redirectOf(changeAdminPassword(passwordChangeForm(WRONG)))).toContain('error=current')
  })
})

describe('sign-up and resend', () => {
  it("doesn't let a stranger's repeated sign-ups stop the owner's confirmation email", async () => {
    mocks.ip = STRANGER_IP
    for (let attempt = 0; attempt < REQUEST_LIMITS.signup.perEmailAndIp + 3; attempt += 1) {
      await redirectOf(signUp({}, signUpForm('sam@shpe.test', 'the strangers passphrase 1')))
    }
    const sent = emailsTo('sam@shpe.test').length
    expect(sent).toBe(REQUEST_LIMITS.signup.perEmailAndIp)

    mocks.ip = OWNER_IP
    await redirectOf(signUp({}, signUpForm('sam@shpe.test', 'the owners own passphrase 1')))
    expect(emailsTo('sam@shpe.test')).toHaveLength(sent + 1)
    expect(emailsTo('sam@shpe.test').at(-1)![0].text).toContain('/join/confirm?token=')
  })

  it("doesn't let a stranger's resend requests stop the owner's", async () => {
    await createMember({ email: 'sam@shpe.test', confirmed: false })
    const resend = async (ip: string) => {
      mocks.ip = ip
      await redirectOf(resendConfirmation({}, emailForm('sam@shpe.test')))
      for (const callback of mocks.afterCallbacks.splice(0)) await callback()
    }
    for (let attempt = 0; attempt < REQUEST_LIMITS.resend_confirmation.perEmailAndIp + 3; attempt += 1) await resend(STRANGER_IP)
    const sent = emailsTo('sam@shpe.test').length
    await resend(OWNER_IP)
    expect(emailsTo('sam@shpe.test')).toHaveLength(sent + 1)
  })
})

async function fillCeiling(action: ThrottledAction, email: string) {
  const { perEmail, perEmailAndIp } = REQUEST_LIMITS[action]
  await getDb()
    .insert(requestThrottle)
    .values(Array.from({ length: perEmail }, (_, n) => ({ action, email, ip: strangerIp(Math.floor(n / perEmailAndIp)) })))
}

describe('per-email ceilings on requests that send email', () => {
  it('stops /forgot-password emails once many sources fill the ceiling', async () => {
    await createMember({ email: 'mia@shpe.test' })
    await fillCeiling('forgot_password', 'mia@shpe.test')
    expect(await forgotPassword('mia@shpe.test', OWNER_IP)).toBe('/forgot-password?sent=1')
    expect(emailsTo('mia@shpe.test')).toHaveLength(0)
  })

  it('stops sign-up emails once many sources fill the ceiling', async () => {
    await fillCeiling('signup', 'sam@shpe.test')
    mocks.ip = OWNER_IP
    expect(await redirectOf(signUp({}, signUpForm('sam@shpe.test', 'the owners own passphrase 1')))).toBe('/join/check-email')
    expect(emailsTo('sam@shpe.test')).toHaveLength(0)
  })

  it('stops new confirmation links once many sources fill the ceiling', async () => {
    await createMember({ email: 'sam@shpe.test', confirmed: false })
    await fillCeiling('resend_confirmation', 'sam@shpe.test')
    mocks.ip = OWNER_IP
    await redirectOf(resendConfirmation({}, emailForm('sam@shpe.test')))
    for (const callback of mocks.afterCallbacks.splice(0)) await callback()
    expect(emailsTo('sam@shpe.test')).toHaveLength(0)
  })
})

describe('storing and counting', () => {
  it('lets exactly the allowance through when one source sends many at once', async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, () => recordRequest('signup', 'sam@shpe.test', STRANGER_IP)),
    )
    expect(results.filter(({ throttled }) => !throttled)).toHaveLength(REQUEST_LIMITS.signup.perEmailAndIp)
    expect(await getDb().select().from(requestThrottle)).toHaveLength(REQUEST_LIMITS.signup.perEmailAndIp)
  })

  it('waits for the lock on that email and flow before counting', async () => {
    const db = getDb()
    const finished: string[] = []
    const holder = db
      .batch([
        db.execute(sql`select pg_advisory_xact_lock(1, hashtext(${'signup:sam@shpe.test'}))`),
        db.execute(sql`select pg_sleep(2)`),
      ])
      .then(() => finished.push('lock holder'))
    await new Promise((resolve) => setTimeout(resolve, 500))
    const attempt = recordRequest('signup', 'sam@shpe.test', STRANGER_IP).then(() => finished.push('attempt'))
    await Promise.all([holder, attempt])
    expect(finished).toEqual(['lock holder', 'attempt'])
  })

  it('lets one source through only up to its own limit when it sends for many emails at once', async () => {
    const { perIp } = REQUEST_LIMITS.admin_password_reset
    const results = await Promise.all(
      Array.from({ length: perIp * 3 }, (_, n) => recordRequest('admin_password_reset', `person${n}@shpe.test`, STRANGER_IP)),
    )
    expect(results.filter(({ throttled }) => !throttled)).toHaveLength(perIp)
    expect(await getDb().select().from(requestThrottle)).toHaveLength(perIp)
  })

  it('waits for the lock on that source and flow before counting, whatever the email', async () => {
    const db = getDb()
    const finished: string[] = []
    const holder = db
      .batch([
        db.execute(sql`select pg_advisory_xact_lock(2, hashtext(${`signup:${STRANGER_IP}`}))`),
        db.execute(sql`select pg_sleep(2)`),
      ])
      .then(() => finished.push('lock holder'))
    await new Promise((resolve) => setTimeout(resolve, 500))
    const attempt = recordRequest('signup', 'someone-else@shpe.test', STRANGER_IP).then(() => finished.push('attempt'))
    await Promise.all([holder, attempt])
    expect(finished).toEqual(['lock holder', 'attempt'])
  })

  it('lets exactly the allowance of sign-in attempts through at once', async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => recordLoginAttempt('max@shpe.test', STRANGER_IP)))
    expect(results.filter(({ throttled }) => !throttled)).toHaveLength(LOGIN_LIMITS.perEmailAndIp)
    expect(await getDb().select().from(loginAttempts)).toHaveLength(LOGIN_LIMITS.perEmailAndIp)
  })

  it('counts each action on its own', async () => {
    for (let n = 0; n < REQUEST_LIMITS.signup.perEmailAndIp; n += 1) await recordRequest('signup', 'mia@shpe.test', STRANGER_IP)
    await expect(recordRequest('signup', 'mia@shpe.test', STRANGER_IP)).resolves.toEqual({ throttled: true })
    await expect(recordRequest('forgot_password', 'mia@shpe.test', STRANGER_IP)).resolves.toEqual({ throttled: false })
  })

  it('forgets and purges attempts older than the window, whatever the flow', async () => {
    const old = new Date(Date.now() - 16 * 60 * 1000)
    const recent = new Date(Date.now() - 14 * 60 * 1000)
    await getDb()
      .insert(requestThrottle)
      .values([
        ...Array.from({ length: 3 }, () => ({ action: 'signup', email: 'mia@shpe.test', ip: STRANGER_IP, createdAt: old })),
        { action: 'contact', email: 'other@shpe.test', ip: null, createdAt: old },
        { action: 'signup', email: 'mia@shpe.test', ip: STRANGER_IP, createdAt: recent },
      ])
    await expect(recordRequest('signup', 'mia@shpe.test', STRANGER_IP)).resolves.toEqual({ throttled: false })
    const rows = await getDb().select().from(requestThrottle)
    expect(rows).toHaveLength(2)
    await expect(recordRequest('signup', 'mia@shpe.test', STRANGER_IP)).resolves.toEqual({ throttled: false })
    await expect(recordRequest('signup', 'mia@shpe.test', STRANGER_IP)).resolves.toEqual({ throttled: true })
  })

  it('counts a header that is not an IP address as an unknown source', async () => {
    for (let n = 0; n < LOGIN_LIMITS.perEmailAndIp; n += 1) await signIn('nobody@shpe.test', WRONG, `junk-${n}`)
    await expect(signIn('nobody@shpe.test', WRONG, 'more-junk')).resolves.toBeNull()
    expect(await getDb().select().from(loginAttempts)).toEqual(
      Array.from({ length: LOGIN_LIMITS.perEmailAndIp }, () => expect.objectContaining({ ip: null })),
    )
  })

  it('counts every spelling of an IPv4-mapped address as that IPv4 address', async () => {
    await createAdmin({ email: 'max@shpe.test' })
    const spellings = ['::ffff:192.0.2.77%eth0', '::ffff:192.0.2.77', '::ffff:c000:24d', '0:0:0:0:0:ffff:192.0.2.77', '::FFFF:C000:024D']
    for (const ip of spellings) await signIn('max@shpe.test', WRONG, ip)
    await expect(signIn('max@shpe.test', TEST_PASSWORD, '::ffff:192.0.2.77')).resolves.toBeNull()
  })
})

describe('the known-device cookie', () => {
  async function fillLoginCeiling(email: string) {
    await getDb()
      .insert(loginAttempts)
      .values(
        Array.from({ length: LOGIN_LIMITS.perEmail }, (_, n) => ({
          email,
          ip: strangerIp(Math.floor(n / LOGIN_LIMITS.perEmailAndIp)),
        })),
      )
  }

  it("lets the owner's browser past a ceiling strangers keep full, and only for that account", async () => {
    await createAdmin({ email: 'max@shpe.test', role: 'master' })
    await createAdmin({ email: 'ada@shpe.test' })
    await fillLoginCeiling('max@shpe.test')
    await fillLoginCeiling('ada@shpe.test')

    await expect(signIn('max@shpe.test', TEST_PASSWORD, OWNER_IP)).resolves.toBeNull()
    const maxDevice = withKnownDevice(undefined, (await deviceAccountFor('max@shpe.test'))!)!
    await expect(authorizeCredentials({ email: 'max@shpe.test', password: TEST_PASSWORD }, OWNER_IP, maxDevice)).resolves.toMatchObject({
      email: 'max@shpe.test',
    })
    await expect(authorizeCredentials({ email: 'ada@shpe.test', password: TEST_PASSWORD }, OWNER_IP, maxDevice)).resolves.toBeNull()
  })

  it('does nothing when forged or tampered with', async () => {
    await createAdmin({ email: 'max@shpe.test' })
    await fillLoginCeiling('max@shpe.test')
    const real = withKnownDevice(undefined, (await deviceAccountFor('max@shpe.test'))!)!
    const flipped = `${real.slice(0, 10)}${real[10] === 'A' ? 'B' : 'A'}${real.slice(11)}`
    for (const cookie of [flipped, 'max@shpe.test', `${real}A`, `${real.slice(0, -1)}`]) {
      await expect(authorizeCredentials({ email: 'max@shpe.test', password: TEST_PASSWORD }, OWNER_IP, cookie)).resolves.toBeNull()
    }
    vi.stubEnv('AUTH_SECRET', 'a secret the attacker guessed')
    const forged = withKnownDevice(undefined, (await deviceAccountFor('max@shpe.test'))!)!
    vi.stubEnv('AUTH_SECRET', 'a test secret for known devices')
    await expect(authorizeCredentials({ email: 'max@shpe.test', password: TEST_PASSWORD }, OWNER_IP, forged)).resolves.toBeNull()
  })

  it('keeps the per-source limit, so the cookie is no help to a guesser', async () => {
    await createAdmin({ email: 'max@shpe.test' })
    const device = withKnownDevice(undefined, (await deviceAccountFor('max@shpe.test'))!)!
    for (let attempt = 0; attempt < LOGIN_LIMITS.perEmailAndIp; attempt += 1) {
      await authorizeCredentials({ email: 'max@shpe.test', password: WRONG }, STRANGER_IP, device)
    }
    await expect(authorizeCredentials({ email: 'max@shpe.test', password: TEST_PASSWORD }, STRANGER_IP, device)).resolves.toBeNull()
  })

  it('is set when a reset link is used, so the next sign-in from that browser works, and the old one stops working', async () => {
    const admin = await createAdmin({ email: 'max@shpe.test', role: 'master' })
    const before = withKnownDevice(undefined, (await deviceAccountFor('max@shpe.test'))!, Date.now() - 1000)!
    const db = getDb()
    const issued = newAdminResetToken(admin.id)
    await db.batch(replaceAdminResetTokens(db, issued.row))
    const form = new FormData()
    form.set('token', issued.token)
    form.set('password', NEW_PASSWORD)
    form.set('confirmPassword', NEW_PASSWORD)
    expect(await redirectOf(resetAdminPasswordWithLink({}, form))).toBe('/login?reset=1')

    await fillLoginCeiling('max@shpe.test')
    const cookie = mocks.cookies.get(KNOWN_DEVICE_COOKIE)
    expect(cookie).toBeDefined()
    await expect(authorizeCredentials({ email: 'max@shpe.test', password: NEW_PASSWORD }, OWNER_IP, cookie)).resolves.toMatchObject({
      email: 'max@shpe.test',
    })
    await expect(authorizeCredentials({ email: 'max@shpe.test', password: NEW_PASSWORD }, '192.0.2.11', before)).resolves.toBeNull()
  })

  it('does nothing for a new account that reuses a deleted account’s address', async () => {
    const first = await createMember({ email: 'mia@shpe.test' })
    const cookie = withKnownDevice(undefined, (await deviceAccountFor('mia@shpe.test'))!)!
    await getDb().delete(members).where(eq(members.id, first.id))
    await createMember({ email: 'mia@shpe.test' })
    await fillLoginCeiling('mia@shpe.test')
    await expect(authorizeCredentials({ email: 'mia@shpe.test', password: TEST_PASSWORD }, OWNER_IP, cookie)).resolves.toBeNull()
  })

  it('is removed when the member deletes their account', async () => {
    const member = await createMember({ email: 'mia@shpe.test' })
    mocks.auth.mockResolvedValue({ user: { id: String(member.id), kind: 'member', email: member.email } })
    mocks.cookies.set(KNOWN_DEVICE_COOKIE, withKnownDevice(undefined, (await deviceAccountFor('mia@shpe.test'))!)!)
    const form = new FormData()
    form.set('confirm', 'DELETE')
    form.set('password', TEST_PASSWORD)
    await deleteAccount(form).catch(() => {})
    expect(mocks.cookies.get(KNOWN_DEVICE_COOKIE)).toBe('')
  })
})
