import { redirect } from 'next/navigation'
import type { Session } from 'next-auth'
import { auth } from '@/auth'

/**
 * On a server configuration error (missing AUTH_SECRET, untrusted host),
 * `auth()` resolves to an error object with no `user` instead of null.
 */
export async function currentSession(): Promise<Session | null> {
  const session = await auth()
  return session?.user ? session : null
}

export async function requireAdmin() {
  const session = await currentSession()
  if (!session) redirect('/login')
  return session
}

export async function requireMaster() {
  const session = await requireAdmin()
  if (session.user.role !== 'master') redirect('/admin')
  return session
}
