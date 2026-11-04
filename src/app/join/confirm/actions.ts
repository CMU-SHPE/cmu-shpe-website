'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { eq, sql } from 'drizzle-orm'
import { getDb } from '@/db'
import { members } from '@/db/schema'
import { WINDOW_MINUTES, clientIp } from '@/lib/login-throttle'
import type { FormState } from '@/lib/member-accounts'
import { findConfirmEmailLink, hashToken } from '@/lib/member-tokens'
import { recordRequest } from '@/lib/request-throttle'

const INVALID_LINK_PATH = '/join/confirm?invalid=1'
const PASSWORD_MISSING = 'Enter the password you chose when you signed up.'
const PASSWORD_MISMATCH =
  "That password doesn't match the sign-up this link was sent for. If you signed up more than once, use the link from the email that followed the sign-up whose password you know, or sign up again."
const THROTTLED = `Too many attempts. Wait ${WINDOW_MINUTES} minutes and try again.`

/**
 * Locking the member first queues a racing confirmation or sign-up behind this one instead of
 * deadlocking on each other's links. The link is only used up if the account is still unconfirmed
 * and its password is the one checked, and copying its sign-up onto the account and revoking every
 * other confirmation link happen in the same statement, so a failure leaves the link working and
 * nothing half done. A link with no sign-up of its own changes nothing but email_confirmed_at.
 */
function confirmWithLink(memberId: number, token: string, checkedPasswordHash: string) {
  const db = getDb()
  const tokenHash = hashToken(token)
  return db.batch([
    db.execute(sql`select id from members where id = ${memberId} for update`),
    db.execute<{ id: number }>(sql`
      with consumed as (
        delete from member_tokens t
        using members m
        where t.token_hash = ${tokenHash} and t.purpose = 'confirm_email' and t.expires_at > now()
          and m.id = t.member_id and m.email_confirmed_at is null
          and coalesce(t.password_hash, m.password_hash) = ${checkedPasswordHash}
        returning t.member_id, t.name, t.password_hash, t.privacy_policy_version, t.age_confirmed_at, t.terms_accepted_at
      ),
      confirmed as (
        update members m set
          email_confirmed_at = ${new Date().toISOString()}::timestamptz,
          name = coalesce(c.name, m.name),
          password_hash = coalesce(c.password_hash, m.password_hash),
          privacy_policy_version = coalesce(c.privacy_policy_version, m.privacy_policy_version),
          age_confirmed_at = coalesce(c.age_confirmed_at, m.age_confirmed_at),
          terms_accepted_at = coalesce(c.terms_accepted_at, m.terms_accepted_at)
        from consumed c
        where m.id = c.member_id and m.email_confirmed_at is null
        returning m.id
      ),
      revoked as (
        delete from member_tokens t using confirmed
        where t.member_id = confirmed.id and t.purpose = 'confirm_email' and t.token_hash <> ${tokenHash}
      )
      select id from confirmed
    `),
  ])
}

/**
 * Anyone can sign up with an address they don't own, and each sign-up gets its own link
 * carrying its own name, password and consent, so clicking a link alone must not activate
 * the account: the visitor also has to know that sign-up's password. A resent link, or one
 * issued before sign-ups were kept per link, stands for the sign-up on the member row. The
 * link is only used up once the password matches, so a wrong one leaves it working.
 * Confirming copies the link's sign-up onto the account and revokes every other
 * confirmation link: the account now belongs to whoever confirmed it.
 */
export async function confirmMemberEmail(_state: FormState, formData: FormData): Promise<FormState> {
  const token = formData.get('token')
  if (typeof token !== 'string') redirect(INVALID_LINK_PATH)
  const link = await findConfirmEmailLink(token)
  if (link === null) redirect(INVALID_LINK_PATH)
  const { memberId, signUp } = link

  const db = getDb()
  const [member] = await db
    .select({ email: members.email, passwordHash: members.passwordHash })
    .from(members)
    .where(eq(members.id, memberId))
    .limit(1)
  if (!member) redirect(INVALID_LINK_PATH)

  const password = formData.get('password')
  if (typeof password !== 'string' || password === '') return { errors: { password: PASSWORD_MISSING } }

  const ip = clientIp((await headers()).get('x-forwarded-for'))
  const { throttled } = await recordRequest('confirm_email', member.email, ip)
  if (throttled) {
    console.warn(`CONFIRM EMAIL THROTTLED from ${ip ?? 'unknown ip'}`)
    return { formError: THROTTLED }
  }
  const checkedPasswordHash = signUp?.passwordHash ?? member.passwordHash
  if (!(await bcrypt.compare(password, checkedPasswordHash))) return { formError: PASSWORD_MISMATCH }

  const [, confirmed] = await confirmWithLink(memberId, token, checkedPasswordHash)
  if (confirmed.rows.length === 0) redirect(INVALID_LINK_PATH)
  redirect('/login?confirmed=1')
}
