'use server'

import { headers } from 'next/headers'
import { redirect, unstable_rethrow } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { and, eq, inArray } from 'drizzle-orm'
import { signIn, signOut } from '@/auth'
import { getDb } from '@/db'
import { memberTopicSubscriptions, members } from '@/db/schema'
import { parsePasswordChange } from '@/lib/admin-account'
import { clearLoginAttempts, recordLoginAttempt } from '@/lib/authorize'
import { EmailSendError, sendEmail } from '@/lib/email'
import { confirmNewEmail, passwordChanged } from '@/lib/email-templates'
import { clientIp } from '@/lib/login-throttle'
import { requireMember } from '@/lib/member'
import {
  accountResultPath,
  diffTopics,
  findMemberForAction,
  getMemberTopicIds,
  parseDeleteConfirmation,
  parseNameForm,
  parseTopicSelection,
} from '@/lib/member-account'
import { memberDeletion } from '@/lib/member-admin'
import { newEmailChange, parseEmailChange, purgeExpiredEmailChanges, savePendingEmailChange } from '@/lib/member-email-change'
import { deleteMemberTokens } from '@/lib/member-tokens'
import { countExistingTopics } from '@/lib/newsletter-topics'
import { recordRequest } from '@/lib/request-throttle'
import { siteUrl } from '@/lib/site-url'

async function currentMemberRow() {
  const session = await requireMember()
  const member = await findMemberForAction(Number(session.user.id))
  if (!member) redirect('/login')
  return member
}

async function isThrottled(email: string) {
  const ip = clientIp((await headers()).get('x-forwarded-for'))
  const { throttled } = await recordLoginAttempt(email, ip)
  return throttled
}

export async function updateName(formData: FormData) {
  const member = await currentMemberRow()
  const parsed = parseNameForm(formData)
  if (!parsed.success) redirect(accountResultPath({ error: 'name' }))

  await getDb().update(members).set({ name: parsed.data }).where(eq(members.id, member.id))
  redirect(accountResultPath({ saved: 'name' }))
}

// The notice is a courtesy; the password has already changed, so a failed send is only logged.
async function notifyPasswordChanged(member: { email: string; name: string }) {
  try {
    await sendEmail({ to: member.email, ...passwordChanged(member.name, `${siteUrl()}/contact`) })
  } catch {
    console.error('EMAIL SEND FAILED: password_changed')
  }
}

/**
 * Nothing changes until the link sent to the new address is used. Whether that address is
 * already taken is only checked then, so this answers the same way for a free address and a
 * taken one. Its own request limit keeps typos here from counting against sign-in.
 */
export async function requestEmailChange(formData: FormData) {
  const member = await currentMemberRow()
  const parsed = parseEmailChange(formData)
  if (!parsed.success) redirect(accountResultPath({ error: parsed.code }))
  const { newEmail, currentPassword } = parsed.data
  if (newEmail === member.email) redirect(accountResultPath({ error: 'email-same' }))

  const ip = clientIp((await headers()).get('x-forwarded-for'))
  const { throttled } = await recordRequest('change_email', member.email, ip)
  if (throttled) redirect(accountResultPath({ error: 'email-throttled' }))
  if (!(await bcrypt.compare(currentPassword, member.passwordHash))) {
    redirect(accountResultPath({ error: 'email-current' }))
  }

  const db = getDb()
  const { token, row } = newEmailChange(member.id, newEmail)
  await db.batch([purgeExpiredEmailChanges(db), savePendingEmailChange(db, row)])
  try {
    await sendEmail({ to: newEmail, ...confirmNewEmail(`${siteUrl()}/account/confirm-email?token=${token}`) })
  } catch (error) {
    if (!(error instanceof EmailSendError)) throw error
    redirect(accountResultPath({ error: 'email-send' }))
  }
  redirect(accountResultPath({ saved: 'email' }))
}

export async function changePassword(formData: FormData) {
  const member = await currentMemberRow()

  const parsed = parsePasswordChange({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  })
  if (!parsed.success) redirect(accountResultPath({ error: `password-${parsed.code}` }))

  if (await isThrottled(member.email)) redirect(accountResultPath({ error: 'password-throttled' }))
  if (!(await bcrypt.compare(parsed.data.currentPassword, member.passwordHash))) {
    redirect(accountResultPath({ error: 'password-current' }))
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12)
  const db = getDb()
  // A reset link emailed before this change would otherwise still set a password for the next hour.
  await db.batch([
    db.update(members).set({ passwordHash, passwordChangedAt: new Date() }).where(eq(members.id, member.id)),
    deleteMemberTokens(db, member.id, 'reset_password'),
  ])
  await clearLoginAttempts(member.email)
  await notifyPasswordChanged(member)

  try {
    await signIn('credentials', {
      email: member.email,
      password: parsed.data.newPassword,
      redirectTo: accountResultPath({ saved: 'password' }),
    })
  } catch (error) {
    unstable_rethrow(error)
    redirect('/login?changed=1')
  }
}

export async function saveTopics(formData: FormData) {
  const member = await currentMemberRow()
  const parsed = parseTopicSelection(formData)
  if (!parsed.success) redirect(accountResultPath({ error: 'topics' }))

  const selected = parsed.data
  if ((await countExistingTopics(selected)) !== selected.length) redirect(accountResultPath({ error: 'topics' }))

  const db = getDb()

  const { add, remove } = diffTopics(await getMemberTopicIds(member.id), selected)
  const writes = [
    ...(add.length > 0
      ? [
          db
            .insert(memberTopicSubscriptions)
            .values(add.map((topicId) => ({ memberId: member.id, topicId })))
            .onConflictDoNothing({ target: [memberTopicSubscriptions.memberId, memberTopicSubscriptions.topicId] }),
        ]
      : []),
    ...(remove.length > 0
      ? [
          db
            .delete(memberTopicSubscriptions)
            .where(
              and(
                eq(memberTopicSubscriptions.memberId, member.id),
                inArray(memberTopicSubscriptions.topicId, remove),
              ),
            ),
        ]
      : []),
  ]
  const [first, ...rest] = writes
  if (first) await db.batch([first, ...rest])

  redirect(accountResultPath({ saved: 'topics' }))
}

export async function deleteAccount(formData: FormData) {
  const member = await currentMemberRow()
  const parsed = parseDeleteConfirmation(formData)
  if (!parsed.success) redirect(accountResultPath({ error: parsed.code }))

  if (await isThrottled(member.email)) redirect(accountResultPath({ error: 'delete-throttled' }))
  if (!(await bcrypt.compare(parsed.password, member.passwordHash))) {
    redirect(accountResultPath({ error: 'delete-current' }))
  }

  const db = getDb()
  await db.batch(memberDeletion(db, member.id))
  await signOut({ redirectTo: '/account/deleted' })
}
