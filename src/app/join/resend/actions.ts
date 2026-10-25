'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { and, eq, isNull } from 'drizzle-orm'
import { getDb } from '@/db'
import { members } from '@/db/schema'
import { EmailSendError, sendEmail } from '@/lib/email'
import { confirmEmail } from '@/lib/email-templates'
import { clientIp } from '@/lib/login-throttle'
import { parseEmailRequest, purgeStaleUnconfirmedMembers, safeValues, type FormState } from '@/lib/member-accounts'
import { deleteMemberTokens, insertMemberToken, newMemberToken } from '@/lib/member-tokens'
import { recordRequest } from '@/lib/request-throttle'
import { siteUrl } from '@/lib/site-url'

/**
 * Sends nothing for unknown, confirmed or admin addresses, so a failed send for a real
 * unconfirmed account is only logged: showing it would reveal that the account exists.
 */
export async function resendConfirmation(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseEmailRequest(formData)
  if (!parsed.success) return { errors: parsed.errors, values: safeValues(formData, ['email']) }
  const { email } = parsed.data

  const base = siteUrl()
  const ip = clientIp((await headers()).get('x-forwarded-for'))
  const { throttled } = await recordRequest('resend_confirmation', email, ip)
  if (throttled) {
    console.warn(`RESEND CONFIRMATION THROTTLED from ${ip ?? 'unknown ip'}`)
    redirect('/join/resend?sent=1')
  }

  const db = getDb()
  await purgeStaleUnconfirmedMembers(db)
  const [member] = await db
    .select({ id: members.id, name: members.name })
    .from(members)
    .where(and(eq(members.email, email), isNull(members.emailConfirmedAt)))
    .limit(1)

  if (member) {
    const { token, row } = newMemberToken(member.id, 'confirm_email')
    await db.batch([deleteMemberTokens(db, member.id, 'confirm_email'), insertMemberToken(db, row)])
    try {
      await sendEmail({ to: email, ...confirmEmail(member.name, `${base}/join/confirm?token=${token}`) })
    } catch (error) {
      if (!(error instanceof EmailSendError)) throw error
      console.error('EMAIL SEND FAILED: confirm_email (resend)')
    }
  }
  redirect('/join/resend?sent=1')
}
