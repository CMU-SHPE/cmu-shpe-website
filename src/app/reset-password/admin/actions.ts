'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { sql } from 'drizzle-orm'
import { getDb } from '@/db'
import { findAdminResetToken } from '@/lib/admin-tokens'
import { EmailSendError, sendEmail } from '@/lib/email'
import { passwordChanged } from '@/lib/email-templates'
import { parsePasswordReset, type FormState } from '@/lib/member-accounts'
import { hashToken } from '@/lib/member-tokens'
import { siteUrl } from '@/lib/site-url'

const INVALID_LINK = 'This reset link has expired or was already used. Request a new one below.'

type ResetAdmin = { email: string; name: string }

/**
 * Mirrors the member reset, but reads only admin_tokens, so a member's link can never reach
 * an admin row. Any admin, the master included, can reset this way. Setting
 * password_changed_at ends every existing session of that admin (see currentAdmin), and the
 * failed sign-ins recorded against the email are cleared so a lockout doesn't outlast the reset.
 */
function resetAdminPasswordWithToken(token: string, passwordHash: string) {
  const tokenHash = hashToken(token)
  return sql`
    with consumed as (
      delete from admin_tokens
      where token_hash = ${tokenHash} and expires_at > now()
      returning admin_id
    ),
    updated as (
      update admins a set password_hash = ${passwordHash}, password_changed_at = ${new Date().toISOString()}::timestamptz
      from consumed where a.id = consumed.admin_id
      returning a.id, a.email, a.name
    ),
    revoked as (
      delete from admin_tokens t using updated
      where t.admin_id = updated.id and t.token_hash <> ${tokenHash}
    ),
    cleared as (
      delete from login_attempts l using updated where l.email = updated.email
    )
    select email, name from updated
  `
}

export async function resetAdminPasswordWithLink(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = parsePasswordReset(formData)
  if (!parsed.success) {
    if (parsed.errors.token) return { formError: INVALID_LINK }
    return { errors: parsed.errors }
  }
  const { token, password } = parsed.data

  const base = siteUrl()
  if ((await findAdminResetToken(token)) === null) return { formError: INVALID_LINK }

  const passwordHash = await bcrypt.hash(password, 12)
  const result = (await getDb().execute(resetAdminPasswordWithToken(token, passwordHash))) as unknown as {
    rows: ResetAdmin[]
  }
  const [admin] = result.rows
  if (!admin) return { formError: INVALID_LINK }

  try {
    await sendEmail({ to: admin.email, ...passwordChanged(admin.name, `${base}/contact`) })
  } catch (error) {
    if (!(error instanceof EmailSendError)) throw error
    console.error('EMAIL SEND FAILED: password_changed')
  }
  redirect('/login?reset=1')
}
