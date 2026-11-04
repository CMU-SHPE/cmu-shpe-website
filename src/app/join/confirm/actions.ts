'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { and, eq, isNull } from 'drizzle-orm'
import { getDb } from '@/db'
import { members } from '@/db/schema'
import { WINDOW_MINUTES, clientIp } from '@/lib/login-throttle'
import type { FormState } from '@/lib/member-accounts'
import { consumeMemberToken, deleteMemberTokens, findConfirmEmailLink } from '@/lib/member-tokens'
import { recordRequest } from '@/lib/request-throttle'

const INVALID_LINK_PATH = '/join/confirm?invalid=1'
const PASSWORD_MISSING = 'Enter the password you chose when you signed up.'
const PASSWORD_MISMATCH =
  "That password doesn't match the sign-up this link was sent for. If you signed up more than once, use the link from the email that followed the sign-up whose password you know, or sign up again."
const THROTTLED = `Too many attempts. Wait ${WINDOW_MINUTES} minutes and try again.`

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
  if (!(await bcrypt.compare(password, signUp?.passwordHash ?? member.passwordHash))) {
    return { formError: PASSWORD_MISMATCH }
  }

  if ((await consumeMemberToken(token, 'confirm_email')) === null) redirect(INVALID_LINK_PATH)

  const confirmed = await db
    .update(members)
    .set({ ...signUp, emailConfirmedAt: new Date() })
    .where(and(eq(members.id, memberId), isNull(members.emailConfirmedAt)))
    .returning({ id: members.id })
  if (confirmed.length === 0) redirect(INVALID_LINK_PATH)

  await deleteMemberTokens(db, memberId, 'confirm_email')
  redirect('/login?confirmed=1')
}
