'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { sendEmail } from '@/lib/email'
import { emailChanged } from '@/lib/email-templates'
import { WINDOW_MINUTES, clientIp } from '@/lib/login-throttle'
import type { FormState } from '@/lib/member-accounts'
import { confirmEmailChange, findEmailChange } from '@/lib/member-email-change'
import { maskEmail } from '@/lib/newsletter-unsubscribe'
import { getSiteSettings } from '@/lib/queries'
import { recordRequest } from '@/lib/request-throttle'
import { siteUrl } from '@/lib/site-url'

const INVALID_LINK_PATH = '/account/confirm-email?invalid=1'
const IN_USE_PATH = '/account/confirm-email?in-use=1'
const PASSWORD_MISSING = 'Enter your current password.'
const PASSWORD_MISMATCH =
  "That password is incorrect, so your email address was not changed. It has to be the current password of the account that asked for this change."
const THROTTLED = `Too many attempts. Wait ${WINDOW_MINUTES} minutes and try again.`

// The change has already happened, so a failed notice is only logged.
async function notifyOldAddress(change: { oldEmail: string; newEmail: string; name: string }) {
  try {
    const settings = await getSiteSettings()
    const contact = settings?.contactEmail || `${siteUrl()}/contact`
    await sendEmail({ to: change.oldEmail, ...emailChanged(change.name, maskEmail(change.newEmail), contact) })
  } catch {
    console.error('EMAIL SEND FAILED: email_changed')
  }
}

/**
 * Anyone can ask for a link to be sent to an address they don't own, so clicking it alone must
 * not move that address onto their account: the visitor also has to know the account's current
 * password. The link is only used up once that matches, so a wrong password changes nothing.
 * A password change between the check and the write cancels the pending change, so the write
 * then finds no link. Every session ends with the change, and the member signs in again.
 */
export async function confirmEmailChangeFromLink(_state: FormState, formData: FormData): Promise<FormState> {
  const token = formData.get('token')
  if (typeof token !== 'string') redirect(INVALID_LINK_PATH)
  const pending = await findEmailChange(token)
  if (!pending) redirect(INVALID_LINK_PATH)

  const password = formData.get('password')
  if (typeof password !== 'string' || password === '') return { errors: { password: PASSWORD_MISSING } }

  const ip = clientIp((await headers()).get('x-forwarded-for'))
  const { throttled } = await recordRequest('confirm_email_change', pending.currentEmail, ip)
  if (throttled) {
    console.warn(`CONFIRM EMAIL CHANGE THROTTLED from ${ip ?? 'unknown ip'}`)
    return { formError: THROTTLED }
  }
  if (!(await bcrypt.compare(password, pending.passwordHash))) return { formError: PASSWORD_MISMATCH }

  const result = await confirmEmailChange(token)
  if (result.status === 'invalid') redirect(INVALID_LINK_PATH)
  if (result.status === 'in_use') redirect(IN_USE_PATH)

  await notifyOldAddress(result)
  redirect('/login?emailChanged=1')
}
