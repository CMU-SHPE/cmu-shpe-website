'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { and, eq, isNotNull } from 'drizzle-orm'
import { getDb } from '@/db'
import { admins, members } from '@/db/schema'
import { newAdminResetToken, replaceAdminResetTokens } from '@/lib/admin-tokens'
import { EmailSendError, sendEmail } from '@/lib/email'
import { adminPasswordReset, resetPassword } from '@/lib/email-templates'
import { clientIp } from '@/lib/login-throttle'
import { parseEmailRequest, safeValues, type FormState } from '@/lib/member-accounts'
import { deleteMemberTokens, insertMemberToken, newMemberToken } from '@/lib/member-tokens'
import { recordRequest } from '@/lib/request-throttle'
import { siteUrl } from '@/lib/site-url'

/**
 * Admins and confirmed members get a link; unconfirmed accounts can ask for a new
 * confirmation link instead. The response never says which case applied, so a failed
 * send is logged rather than shown.
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

  // Looking up and emailing only a real member takes longer, so it all happens after
  // responding: otherwise response time would reveal which addresses have accounts.
  after(async () => {
    try {
      await sendResetLink(email, base, ip)
    } catch (error) {
      console.error(error instanceof EmailSendError ? 'EMAIL SEND FAILED: reset_password' : 'PASSWORD RESET FAILED')
    }
  })
  redirect('/forgot-password?sent=1')
}

/**
 * An admin row wins over a member row with the same email, as it does at sign-in. Admin links
 * go in admin_tokens and open /reset-password/admin, so neither kind of link can reset the other
 * kind of account. Admin links also have their own, tighter limit.
 */
async function sendResetLink(email: string, base: string, ip: string | null) {
  const db = getDb()
  const [[admin], [member]] = await Promise.all([
    db.select({ id: admins.id, name: admins.name }).from(admins).where(eq(admins.email, email)).limit(1),
    db
      .select({ id: members.id, name: members.name })
      .from(members)
      .where(and(eq(members.email, email), isNotNull(members.emailConfirmedAt)))
      .limit(1),
  ])

  if (admin) {
    const { throttled } = await recordRequest('admin_password_reset', email, ip)
    if (throttled) {
      console.warn(`ADMIN PASSWORD RESET THROTTLED from ${ip ?? 'unknown ip'}`)
      return
    }
    const { token, row } = newAdminResetToken(admin.id)
    await db.batch(replaceAdminResetTokens(db, row))
    await sendEmail({ to: email, ...adminPasswordReset(admin.name, `${base}/reset-password/admin?token=${token}`) })
    return
  }
  if (!member) return

  const { token, row } = newMemberToken(member.id, 'reset_password')
  await db.batch([deleteMemberTokens(db, member.id, 'reset_password'), insertMemberToken(db, row)])
  await sendEmail({ to: email, ...resetPassword(member.name, `${base}/reset-password?token=${token}`) })
}
