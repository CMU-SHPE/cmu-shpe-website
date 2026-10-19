import { redirect } from 'next/navigation'
import { auth } from '@/auth'

export async function requireAdmin() {
  const session = await auth()
  if (!session) redirect('/login')
  return session
}

export async function requireMaster() {
  const session = await requireAdmin()
  if (session.user.role !== 'master') redirect('/admin')
  return session
}
