'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { loginAttempts, members } from '@/db/schema'
import { EmailSendError, sendEmail } from '@/lib/email'
import { passwordChanged } from '@/lib/email-templates'
import { parsePasswordReset, type FormState } from '@/lib/member-accounts'
import { consumeMemberToken, deleteMemberTokens } from '@/lib/member-tokens'
import { siteUrl } from '@/lib/site-url'

const INVALID_LINK = 'This reset link has expired or was already used. Request a new one below.'

/**
 * The new password is checked before the token is used, so a typo doesn't burn the link.
 * password_changed_at uses the server clock, matching the authTime it is compared with.
 */
export async function resetMemberPassword(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = parsePasswordReset(formData)
  if (!parsed.success) {
    if (parsed.errors.token) return { formError: INVALID_LINK }
    return { errors: parsed.errors }
  }
  const { token, password } = parsed.data

  const base = siteUrl()
  const memberId = await consumeMemberToken(token, 'reset_password')
  if (memberId === null) return { formError: INVALID_LINK }

  const db = getDb()
  const [member] = await db
    .select({ email: members.email, name: members.name })
    .from(members)
    .where(eq(members.id, memberId))
    .limit(1)
  if (!member) return { formError: INVALID_LINK }

  const passwordHash = await bcrypt.hash(password, 12)
  await db.batch([
    db.update(members).set({ passwordHash, passwordChangedAt: new Date() }).where(eq(members.id, memberId)),
    deleteMemberTokens(db, memberId, 'reset_password'),
    db.delete(loginAttempts).where(eq(loginAttempts.email, member.email)),
  ])

  try {
    await sendEmail({ to: member.email, ...passwordChanged(member.name, `${base}/contact`) })
  } catch (error) {
    if (!(error instanceof EmailSendError)) throw error
    console.error('EMAIL SEND FAILED: password_changed')
  }
  redirect('/login?reset=1')
}
