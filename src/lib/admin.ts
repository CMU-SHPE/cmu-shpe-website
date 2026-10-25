import { cache } from 'react'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import type { Session } from 'next-auth'
import { auth } from '@/auth'
import { getDb } from '@/db'
import { admins } from '@/db/schema'
import { adminId, mayCreateAccounts, sessionPredatesPasswordChange } from '@/lib/admin-account'

/**
 * On a server configuration error (missing AUTH_SECRET, untrusted host),
 * `auth()` resolves to an error object with no `user` instead of null.
 */
export async function currentSession(): Promise<Session | null> {
  const session = await auth()
  return session?.user ? session : null
}

/**
 * Sessions are JWTs, so a deleted or demoted admin keeps a valid token until it
 * expires. This re-checks the admins row and takes the role and the account
 * creation permission from the database, so revoking either applies on the next
 * request; matching the email too stops a token from mapping onto a different admin
 * that later reused the same id, and a password change ends sessions signed in before it.
 */
export const currentAdmin = cache(async (): Promise<Session | null> => {
  const session = await currentSession()
  if (!session) return null

  const id = adminId.safeParse(Number(session.user.id))
  const email = session.user.email
  if (!id.success || !email) return null

  const [row] = await getDb()
    .select({
      role: admins.role,
      canCreateAccounts: admins.canCreateAccounts,
      email: admins.email,
      passwordChangedAt: admins.passwordChangedAt,
    })
    .from(admins)
    .where(eq(admins.id, id.data))
    .limit(1)
  if (!row || row.email !== email) return null
  if (sessionPredatesPasswordChange(session.authTime, row.passwordChangedAt)) return null

  return { ...session, user: { ...session.user, role: row.role, canCreateAccounts: row.canCreateAccounts } }
})

export async function requireAdmin() {
  const admin = await currentAdmin()
  if (!admin) redirect('/login')
  return admin
}

export async function requireMaster() {
  const admin = await requireAdmin()
  if (admin.user.role !== 'master') redirect('/admin')
  return admin
}

export async function requireAccountCreator() {
  const admin = await requireAdmin()
  if (!mayCreateAccounts(admin.user)) redirect('/admin')
  return admin
}
