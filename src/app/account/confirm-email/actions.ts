'use server'

import { redirect } from 'next/navigation'
import { sendEmail } from '@/lib/email'
import { emailChanged } from '@/lib/email-templates'
import type { FormState } from '@/lib/member-accounts'
import { confirmEmailChange } from '@/lib/member-email-change'
import { getSiteSettings } from '@/lib/queries'
import { siteUrl } from '@/lib/site-url'

const INVALID_LINK_PATH = '/account/confirm-email?invalid=1'
const IN_USE_PATH = '/account/confirm-email?in-use=1'

// The change has already happened, so a failed notice is only logged.
async function notifyOldAddress(change: { oldEmail: string; newEmail: string; name: string }) {
  try {
    const settings = await getSiteSettings()
    const contact = settings?.contactEmail || `${siteUrl()}/contact`
    await sendEmail({ to: change.oldEmail, ...emailChanged(change.name, change.newEmail, contact) })
  } catch {
    console.error('EMAIL SEND FAILED: email_changed')
  }
}

/**
 * Every session carries the old address, which currentMember no longer matches, so the change
 * signs the member out everywhere and they sign in again with the new one.
 */
export async function confirmEmailChangeFromLink(_state: FormState, formData: FormData): Promise<FormState> {
  const token = formData.get('token')
  if (typeof token !== 'string') redirect(INVALID_LINK_PATH)

  const result = await confirmEmailChange(token)
  if (result.status === 'invalid') redirect(INVALID_LINK_PATH)
  if (result.status === 'in_use') redirect(IN_USE_PATH)

  await notifyOldAddress(result)
  redirect('/login?emailChanged=1')
}
