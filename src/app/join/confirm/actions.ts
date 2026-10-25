'use server'

import { redirect } from 'next/navigation'
import { and, eq, isNull } from 'drizzle-orm'
import { getDb } from '@/db'
import { members } from '@/db/schema'
import { consumeMemberToken, deleteMemberTokens } from '@/lib/member-tokens'

export async function confirmMemberEmail(formData: FormData) {
  const token = formData.get('token')
  const memberId = typeof token === 'string' ? await consumeMemberToken(token, 'confirm_email') : null
  if (memberId === null) redirect('/join/confirm?invalid=1')

  const db = getDb()
  await db.batch([
    db
      .update(members)
      .set({ emailConfirmedAt: new Date() })
      .where(and(eq(members.id, memberId), isNull(members.emailConfirmedAt))),
    deleteMemberTokens(db, memberId, 'confirm_email'),
  ])
  redirect('/login?confirmed=1')
}
