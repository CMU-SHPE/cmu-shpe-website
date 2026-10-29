'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { getDb, type Db } from '@/db'
import { admins, members } from '@/db/schema'
import { isUniqueViolation } from '@/lib/db-errors'
import { EmailSendError, sendEmail } from '@/lib/email'
import { accountExists, adminAccountExists, confirmEmail, type EmailContent } from '@/lib/email-templates'
import { clientIp } from '@/lib/login-throttle'
import {
  SEND_FAILED_MESSAGE,
  parseSignUp,
  purgeStaleUnconfirmedMembers,
  safeValues,
  type FormState,
} from '@/lib/member-accounts'
import { deleteMemberTokens, insertMemberToken, newMemberToken } from '@/lib/member-tokens'
import { getPrivacyPolicyVersion } from '@/lib/queries'
import { recordRequest } from '@/lib/request-throttle'
import { siteUrl } from '@/lib/site-url'

const CHECK_EMAIL_PATH = '/join/check-email'

type SignUp = {
  name: string
  email: string
  passwordHash: string
  privacyPolicyVersion: string
  base: string
}

function confirmLink(base: string, token: string) {
  return `${base}/join/confirm?token=${token}`
}

// The new and unconfirmed paths spend one more round trip on their write batch. This
// read-only one stops an existing account from answering measurably faster.
function matchWriteRoundTrip(db: Db) {
  return db.execute(sql`select 1`)
}

/**
 * Picks the one email this sign-up sends. An existing account is never changed or
 * revealed; an unconfirmed one is taken over by the newest sign-up, so registering
 * someone else's address first can't lock them out of it. Confirming then needs that
 * newest sign-up's password, so the owner clicking the link can't activate someone
 * else's.
 */
async function prepareSignUpEmail(db: Db, signUp: SignUp, retried = false): Promise<EmailContent> {
  const { name, email, passwordHash, privacyPolicyVersion, base } = signUp

  const [[admin], [member]] = await Promise.all([
    db.select({ name: admins.name }).from(admins).where(eq(admins.email, email)).limit(1),
    db
      .select({ id: members.id, name: members.name, emailConfirmedAt: members.emailConfirmedAt })
      .from(members)
      .where(eq(members.email, email))
      .limit(1),
  ])
  if (admin) {
    await matchWriteRoundTrip(db)
    return adminAccountExists(admin.name, `${base}/login`, `${base}/forgot-password`)
  }
  if (member?.emailConfirmedAt) {
    await matchWriteRoundTrip(db)
    return accountExists(member.name, `${base}/login`, `${base}/forgot-password`)
  }

  const now = new Date()
  const details = { name, passwordHash, privacyPolicyVersion, ageConfirmedAt: now, termsAcceptedAt: now }

  if (member) {
    const { token, row } = newMemberToken(member.id, 'confirm_email')
    await db.batch([
      // A confirmation landing since the lookup above must not let this sign-up replace the password.
      db.update(members).set(details).where(and(eq(members.id, member.id), isNull(members.emailConfirmedAt))),
      deleteMemberTokens(db, member.id, 'confirm_email'),
      insertMemberToken(db, row),
    ])
    return confirmEmail(confirmLink(base, token))
  }

  const newMemberId = sql`(select ${members.id} from ${members} where ${members.email} = ${email})`
  const { token, row } = newMemberToken(newMemberId, 'confirm_email')
  try {
    await db.batch([db.insert(members).values({ email, ...details }), insertMemberToken(db, row)])
  } catch (error) {
    // A simultaneous sign-up for the same address won the insert; treat this one as arriving second.
    if (!retried && isUniqueViolation(error)) return prepareSignUpEmail(db, signUp, true)
    throw error
  }
  return confirmEmail(confirmLink(base, token))
}

/**
 * Every outcome looks the same from outside: one password hash, one email, and the same
 * "check your inbox" page, so the form can't be used to find out who has an account.
 */
export async function signUp(_state: FormState, formData: FormData): Promise<FormState> {
  const values = safeValues(formData, ['name', 'email', 'ageConfirmed', 'termsAccepted'])
  const parsed = parseSignUp(formData)
  if (!parsed.success) return { errors: parsed.errors, values }
  const { name, email, password } = parsed.data

  const base = siteUrl()
  const privacyPolicyVersion = await getPrivacyPolicyVersion()
  const ip = clientIp((await headers()).get('x-forwarded-for'))

  const { throttled } = await recordRequest('signup', email, ip)
  if (throttled) {
    console.warn(`SIGNUP THROTTLED from ${ip ?? 'unknown ip'}`)
    redirect(CHECK_EMAIL_PATH)
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const db = getDb()
  await purgeStaleUnconfirmedMembers(db)
  const message = await prepareSignUpEmail(db, { name, email, passwordHash, privacyPolicyVersion, base })

  try {
    await sendEmail({ to: email, ...message })
  } catch (error) {
    if (error instanceof EmailSendError) return { formError: SEND_FAILED_MESSAGE, values }
    throw error
  }
  redirect(CHECK_EMAIL_PATH)
}
