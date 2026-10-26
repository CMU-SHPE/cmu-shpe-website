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
import { sendEmail } from '@/lib/email'
import { passwordChanged } from '@/lib/email-templates'
import { clientIp } from '@/lib/login-throttle'
import { requireMember } from '@/lib/member'
import {
  diffTopics,
  findMemberForAction,
  getMemberTopicIds,
  parseDeleteConfirmation,
  parseNameForm,
  parseTopicSelection,
} from '@/lib/member-account'
import { memberDeletion } from '@/lib/member-admin'
import { deleteMemberTokens } from '@/lib/member-tokens'
import { countExistingTopics } from '@/lib/newsletter-topics'
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
  if (!parsed.success) redirect('/account?error=name')

  await getDb().update(members).set({ name: parsed.data }).where(eq(members.id, member.id))
  redirect('/account?saved=name')
}

// The notice is a courtesy; the password has already changed, so a failed send is only logged.
async function notifyPasswordChanged(member: { email: string; name: string }) {
  try {
    await sendEmail({ to: member.email, ...passwordChanged(member.name, `${siteUrl()}/contact`) })
  } catch {
    console.error('EMAIL SEND FAILED: password_changed')
  }
}

export async function changePassword(formData: FormData) {
  const member = await currentMemberRow()

  const parsed = parsePasswordChange({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  })
  if (!parsed.success) redirect(`/account?error=password-${parsed.code}`)

  if (await isThrottled(member.email)) redirect('/account?error=password-throttled')
  if (!(await bcrypt.compare(parsed.data.currentPassword, member.passwordHash))) {
    redirect('/account?error=password-current')
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
      redirectTo: '/account?saved=password',
    })
  } catch (error) {
    unstable_rethrow(error)
    redirect('/login?changed=1')
  }
}

export async function saveTopics(formData: FormData) {
  const member = await currentMemberRow()
  const parsed = parseTopicSelection(formData)
  if (!parsed.success) redirect('/account?error=topics')

  const selected = parsed.data
  if ((await countExistingTopics(selected)) !== selected.length) redirect('/account?error=topics')

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

  redirect('/account?saved=topics')
}

export async function deleteAccount(formData: FormData) {
  const member = await currentMemberRow()
  const parsed = parseDeleteConfirmation(formData)
  if (!parsed.success) redirect(`/account?error=${parsed.code}`)

  if (await isThrottled(member.email)) redirect('/account?error=delete-throttled')
  if (!(await bcrypt.compare(parsed.password, member.passwordHash))) redirect('/account?error=delete-current')

  const db = getDb()
  await db.batch(memberDeletion(db, member.id))
  await signOut({ redirectTo: '/account/deleted' })
}
