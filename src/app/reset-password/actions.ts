'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { sql } from 'drizzle-orm'
import { getDb } from '@/db'
import { EmailSendError, sendEmail } from '@/lib/email'
import { passwordChanged } from '@/lib/email-templates'
import { parsePasswordReset, type FormState } from '@/lib/member-accounts'
import { findMemberToken, hashToken } from '@/lib/member-tokens'
import { siteUrl } from '@/lib/site-url'

const INVALID_LINK = 'This reset link has expired or was already used. Request a new one below.'

type ResetMember = { email: string; name: string }

/**
 * One statement uses up the link and sets the password, so a failed write leaves the link
 * working and two requests racing with it can't both set a password: the second one's
 * DELETE waits for the first's row lock, then finds nothing to consume.
 */
function resetPasswordWithToken(token: string, passwordHash: string) {
  const tokenHash = hashToken(token)
  return sql`
    with consumed as (
      delete from member_tokens
      where token_hash = ${tokenHash} and purpose = 'reset_password' and expires_at > now()
      returning member_id
    ),
    updated as (
      update members m set password_hash = ${passwordHash}, password_changed_at = ${new Date().toISOString()}::timestamptz
      from consumed where m.id = consumed.member_id
      returning m.id, m.email, m.name
    ),
    revoked as (
      delete from member_tokens t using updated
      where t.member_id = updated.id and t.purpose = 'reset_password' and t.token_hash <> ${tokenHash}
    ),
    cleared as (
      delete from login_attempts l using updated where l.email = updated.email
    )
    select email, name from updated
  `
}

/**
 * The new password is checked before the token is used, so a typo doesn't burn the link,
 * and the link is looked up before hashing, so a made-up token costs no bcrypt work.
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
  if ((await findMemberToken(token, 'reset_password')) === null) return { formError: INVALID_LINK }

  const passwordHash = await bcrypt.hash(password, 12)
  const result = (await getDb().execute(resetPasswordWithToken(token, passwordHash))) as unknown as {
    rows: ResetMember[]
  }
  const [member] = result.rows
  if (!member) return { formError: INVALID_LINK }

  try {
    await sendEmail({ to: member.email, ...passwordChanged(member.name, `${base}/contact`) })
  } catch (error) {
    if (!(error instanceof EmailSendError)) throw error
    console.error('EMAIL SEND FAILED: password_changed')
  }
  redirect('/login?reset=1')
}
