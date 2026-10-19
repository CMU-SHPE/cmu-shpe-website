import { cache } from 'react'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import type { Session } from 'next-auth'
import { auth } from '@/auth'
import { getDb } from '@/db'
import { admins } from '@/db/schema'

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
 * expires. This re-checks the admins row and takes the role from the database.
 */
export const currentAdmin = cache(async (): Promise<Session | null> => {
  const session = await currentSession()
  if (!session) return null

  const id = Number(session.user.id)
  if (!Number.isInteger(id) || id <= 0) return null

  const [row] = await getDb()
    .select({ role: admins.role })
    .from(admins)
    .where(eq(admins.id, id))
    .limit(1)
  if (!row) return null

  return { ...session, user: { ...session.user, role: row.role } }
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
