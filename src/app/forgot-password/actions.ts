'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { and, eq, isNotNull } from 'drizzle-orm'
import { getDb } from '@/db'
import { admins, members } from '@/db/schema'
import { EmailSendError, sendEmail } from '@/lib/email'
import { resetPassword } from '@/lib/email-templates'
import { clientIp } from '@/lib/login-throttle'
import { parseEmailRequest, safeValues, type FormState } from '@/lib/member-accounts'
import { deleteMemberTokens, insertMemberToken, newMemberToken } from '@/lib/member-tokens'
import { recordRequest } from '@/lib/request-throttle'
import { siteUrl } from '@/lib/site-url'

/**
 * Only confirmed members get a link. Admins are reset by the master, and unconfirmed
 * accounts can ask for a new confirmation link instead. The response never says which
 * case applied, so a failed send is logged rather than shown.
 */
export async function requestPasswordReset(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseEmailRequest(formData)
  if (!parsed.success) return { errors: parsed.errors, values: safeValues(formData, ['email']) }
  const { email } = parsed.data

  const base = siteUrl()
  const ip = clientIp((await headers()).get('x-forwarded-for'))
  const { throttled } = await recordRequest('forgot_password', email, ip)
  if (throttled) {
    console.warn(`PASSWORD RESET THROTTLED from ${ip ?? 'unknown ip'}`)
    redirect('/forgot-password?sent=1')
  }

  const db = getDb()
  const [[admin], [member]] = await Promise.all([
    db.select({ id: admins.id }).from(admins).where(eq(admins.email, email)).limit(1),
    db
      .select({ id: members.id, name: members.name })
      .from(members)
      .where(and(eq(members.email, email), isNotNull(members.emailConfirmedAt)))
      .limit(1),
  ])

  if (member && !admin) {
    const { token, row } = newMemberToken(member.id, 'reset_password')
    await db.batch([deleteMemberTokens(db, member.id, 'reset_password'), insertMemberToken(db, row)])
    try {
      await sendEmail({ to: email, ...resetPassword(member.name, `${base}/reset-password?token=${token}`) })
    } catch (error) {
      if (!(error instanceof EmailSendError)) throw error
      console.error('EMAIL SEND FAILED: reset_password')
    }
  }
  redirect('/forgot-password?sent=1')
}
