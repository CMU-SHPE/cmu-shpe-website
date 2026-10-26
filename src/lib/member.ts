import { cache } from 'react'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import type { Session } from 'next-auth'
import { getDb } from '@/db'
import { members, type MemberRole } from '@/db/schema'
import { currentSession } from '@/lib/admin'
import { sessionPredatesPasswordChange } from '@/lib/admin-account'
import { recordId } from '@/lib/form-fields'

export type MemberSession = Session & {
  user: Session['user'] & { kind: 'member'; role: MemberRole; name: string }
}

/**
 * Mirrors currentAdmin for member sessions: the token must say it is a member's, and
 * the members row is re-read on every request so a deleted account, a reused id, or a
 * password reset ends the session. Role and name come from the database.
 */
export const currentMember = cache(async (): Promise<MemberSession | null> => {
  const session = await currentSession()
  if (!session || session.user.kind !== 'member') return null

  const id = recordId.safeParse(session.user.id)
  const email = session.user.email
  if (!id.success || !email) return null

  const [row] = await getDb()
    .select({
      email: members.email,
      name: members.name,
      role: members.role,
      emailConfirmedAt: members.emailConfirmedAt,
      passwordChangedAt: members.passwordChangedAt,
    })
    .from(members)
    .where(eq(members.id, id.data))
    .limit(1)
  if (!row || row.email !== email || !row.emailConfirmedAt) return null
  if (sessionPredatesPasswordChange(session.authTime, row.passwordChangedAt)) return null

  return { ...session, user: { ...session.user, kind: 'member', role: row.role, name: row.name } }
})

export async function requireMember() {
  const member = await currentMember()
  if (!member) redirect('/login')
  return member
}
