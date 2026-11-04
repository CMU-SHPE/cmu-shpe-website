'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { type SQL, and, eq, exists, isNull, sql } from 'drizzle-orm'
import { getDb, type Db } from '@/db'
import { admins, members } from '@/db/schema'
import { lockAccountEmails } from '@/lib/account-email-lock'
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
import { confirmEmailLink, insertMemberToken, newConfirmEmailToken, type SignUpDetails } from '@/lib/member-tokens'
import { getPrivacyPolicyVersion } from '@/lib/queries'
import { recordRequest } from '@/lib/request-throttle'
import { siteUrl } from '@/lib/site-url'

const CHECK_EMAIL_PATH = '/join/check-email'

type ConfirmEmailTokenRow = ReturnType<typeof newConfirmEmailToken>['row']

type SignUp = {
  name: string
  email: string
  passwordHash: string
  privacyPolicyVersion: string
  base: string
}

/**
 * A plain INSERT could not depend on the row: selecting from it adds nothing once it is confirmed.
 * FOR SHARE makes it wait behind a confirmation that has locked the row, then re-check the row as
 * that confirmation left it, so a link is never added after the confirmation revoked the others.
 */
function insertTokenIfUnconfirmed(db: Db, stillUnconfirmed: SQL | undefined, row: ConfirmEmailTokenRow) {
  return db.execute<{ member_id: number }>(sql`
    insert into member_tokens (
      member_id, purpose, token_hash, expires_at,
      name, password_hash, privacy_policy_version, age_confirmed_at, terms_accepted_at
    )
    select ${members.id}, ${row.purpose}::member_token_purpose, ${row.tokenHash}, ${row.expiresAt.toISOString()}::timestamptz,
      ${row.name}, ${row.passwordHash}, ${row.privacyPolicyVersion},
      ${row.ageConfirmedAt.toISOString()}::timestamptz, ${row.termsAcceptedAt.toISOString()}::timestamptz
    from ${members}
    where ${stillUnconfirmed}
    for share
    returning member_id
  `)
}

// The new and unconfirmed paths spend one more round trip on their write batch. This
// read-only one stops an existing account from answering measurably faster.
function matchWriteRoundTrip(db: Db) {
  return db.execute(sql`select 1`)
}

function adminEmailIs(email: string) {
  return sql`lower(${admins.email}) = ${email}`
}

/** An admin created since the lookup in prepareSignUpEmail keeps the address; the sign-up is answered as for an admin. */
function undoIfAdminHolds(db: Db, email: string) {
  const adminHolds = db.select({ id: admins.id }).from(admins).where(adminEmailIs(email))
  return db
    .delete(members)
    .where(and(eq(members.email, email), exists(adminHolds)))
    .returning({ id: members.id })
}

/**
 * Picks the one email this sign-up sends. An existing account is never changed or
 * revealed. An unconfirmed one is left as it is too: this sign-up only gets a link of
 * its own, carrying its name, password and consent, and earlier links keep working. So a
 * stranger signing up with someone's address can't cancel the owner's link, and the
 * owner clicking the stranger's link can't activate it without the stranger's password.
 */
async function prepareSignUpEmail(db: Db, signUp: SignUp, retried = false): Promise<EmailContent> {
  const { name, email, passwordHash, privacyPolicyVersion, base } = signUp

  const [[admin], [member]] = await Promise.all([
    db.select({ name: admins.name }).from(admins).where(adminEmailIs(email)).limit(1),
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
  const details: SignUpDetails = { name, passwordHash, privacyPolicyVersion, ageConfirmedAt: now, termsAcceptedAt: now }

  if (member) {
    const { token, row } = newConfirmEmailToken(member.id, details)
    // Confirmed or deleted since the lookup above: no link, and the answer an existing account gets.
    const stillUnconfirmed = and(eq(members.id, member.id), isNull(members.emailConfirmedAt))
    const [linked] = await db.batch([insertTokenIfUnconfirmed(db, stillUnconfirmed, row)])
    if (linked.rows.length === 0) return accountExists(member.name, `${base}/login`, `${base}/forgot-password`)
    return confirmEmail(confirmEmailLink(base, token))
  }

  const newMemberId = sql`(select ${members.id} from ${members} where ${members.email} = ${email})`
  const { token, row } = newConfirmEmailToken(newMemberId, details)
  let undone: { id: number }[]
  try {
    const results = await db.batch([
      db.execute(lockAccountEmails),
      db.insert(members).values({ email, ...details }),
      insertMemberToken(db, row),
      undoIfAdminHolds(db, email),
    ])
    undone = results[3]
  } catch (error) {
    // A simultaneous sign-up for the same address won the insert; treat this one as arriving second.
    if (!retried && isUniqueViolation(error)) return prepareSignUpEmail(db, signUp, true)
    throw error
  }
  if (undone.length > 0) {
    if (retried) throw new Error('An admin account claimed this address during sign-up twice in a row')
    return prepareSignUpEmail(db, signUp, true)
  }
  return confirmEmail(confirmEmailLink(base, token))
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
