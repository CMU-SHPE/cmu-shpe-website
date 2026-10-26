'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { and, eq, isNull } from 'drizzle-orm'
import { getDb } from '@/db'
import { members } from '@/db/schema'
import { WINDOW_MINUTES, clientIp } from '@/lib/login-throttle'
import type { FormState } from '@/lib/member-accounts'
import { consumeMemberToken, deleteMemberTokens, findMemberToken } from '@/lib/member-tokens'
import { recordRequest } from '@/lib/request-throttle'

const INVALID_LINK_PATH = '/join/confirm?invalid=1'
const PASSWORD_MISSING = 'Enter the password you chose when you signed up.'
const PASSWORD_MISMATCH =
  "That password doesn't match this sign-up. If you didn't make the most recent sign-up for this email, sign up again with the password you want."
const THROTTLED = `Too many attempts. Wait ${WINDOW_MINUTES} minutes and try again.`

/**
 * Anyone can sign up with an address they don't own, and a later sign-up replaces an
 * unconfirmed one's password, so clicking the link alone must not activate the account:
 * the visitor also has to know the latest sign-up's password. The link is only used up
 * once that matches, so a wrong password leaves it working.
 */
export async function confirmMemberEmail(_state: FormState, formData: FormData): Promise<FormState> {
  const token = formData.get('token')
  if (typeof token !== 'string') redirect(INVALID_LINK_PATH)
  const memberId = await findMemberToken(token, 'confirm_email')
  if (memberId === null) redirect(INVALID_LINK_PATH)

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
  if (!(await bcrypt.compare(password, member.passwordHash))) return { formError: PASSWORD_MISMATCH }

  if ((await consumeMemberToken(token, 'confirm_email')) === null) redirect(INVALID_LINK_PATH)

  await db.batch([
    db
      .update(members)
      .set({ emailConfirmedAt: new Date() })
      .where(
        and(
          eq(members.id, memberId),
          isNull(members.emailConfirmedAt),
          // A sign-up landing between the password check and this write must not be the one activated.
          eq(members.passwordHash, member.passwordHash),
        ),
      ),
    deleteMemberTokens(db, memberId, 'confirm_email'),
  ])
  redirect('/login?confirmed=1')
}
